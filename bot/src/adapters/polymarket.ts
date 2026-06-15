import type { MarketQuote, OutcomeOdds } from '../types';
import { canonicalTeamName } from './teamNames';
import { type LeagueConfig, ACTIVE_LEAGUE } from '../leagues';
import { createLogger } from '../logger';
import { polymarketBookCache } from '../services/polymarketBookCache';
import { polymarketOddsCache } from '../services/polymarketOddsCache';

const log = createLogger('polymarket');

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';
const GAMMA_LIMIT = 500;
const CLOB_BATCH_SIZE = 10;
const CLOB_BATCH_DELAY_MS = 200;
const TOP_LEVELS = 5;
// Polymarket V2 sets the taker fee rate per category. All synced leagues are
// sports (rate = 0.03 per the published fee schedule). We hardcode the rate
// instead of fetching /clob-markets/{conditionId} for every market every cycle —
// that fetch was lossy under flaky connectivity (random un-adjusted markets) and
// the per-market data Polymarket returns is in practice constant within a
// category. The smoke check below verifies the assumption once per cycle and
// loudly warns if Polymarket ever ships a market with a different rate.
export const SPORTS_FEE_RATE = 0.03;
const SMOKE_CHECK_TIMEOUT_MS = 6_000;

interface GammaMarket {
  conditionId: string;
  question: string;
  clobTokenIds: string; // stringified JSON array
  outcomes: string; // stringified JSON array
  outcomePrices: string; // stringified JSON array
  active: boolean;
  closed: boolean;
  liquidity: string;
  sportsMarketType?: string; // 'spreads' | 'totals' — present on More Markets sub-markets
  line?: number;             // handicap/total line value, e.g. -1.5 or 2.5
  gameStartTime?: string;    // "YYYY-MM-DD HH:MM:SS+00" — actual game kickoff time
}

// V2 `/clob-markets/{conditionId}` response. We only need fd (fee details) for fee-adjusted odds.
// fd.r = rate, fd.e = exponent (1 in all current categories), fd.to = taker-only flag.
interface ClobMarketInfo {
  c?: string;
  fd?: { r?: number; e?: number; to?: boolean };
}

interface GammaEvent {
  id: string;
  title: string;
  slug: string;              // e.g. "ucl-arsenal-vs-sporting-cp" — use for league filtering
  startDate: string;         // market creation date — NOT the game time
  endDate?: string;          // market resolution deadline — NOT reliable for game time (baseball: ~7 days out)
  seriesSlug?: string | null; // often null in real API; prefer slug
  markets: GammaMarket[];
}

interface ClobBookLevel {
  price: string;
  size: string;
}

interface ClobBook {
  bids: ClobBookLevel[];
  asks: ClobBookLevel[];
}

// One entry per tradeable outcome within a 1X2 event
interface OutcomeEntry {
  label: string;
  tokenId: string;
  fallbackPrice: number;
  liquidity: number;
  feeRate: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyFee(p: number, feeRate: number): number {
  if (feeRate === 0) return p;
  return p + feeRate * p * (1 - p);
}

function parseJsonField<T>(raw: string | T[]): T[] {
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

// Fetch ALL league events — both 1X2 match events and game-lines events (with ' - ' in title).
async function fetchLeagueEvents(league: LeagueConfig): Promise<GammaEvent[]> {
  const pm = league.polymarket!;
  const events: GammaEvent[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      active: 'true',
      closed: 'false',
      limit: String(GAMMA_LIMIT),
      offset: String(offset),
      series_id: String(pm.seriesId),
    });

    const res = await fetch(`${GAMMA_API}/events?${params}`);
    if (!res.ok) throw new Error(`Gamma GET /events returned ${res.status}`);

    const pageData = (await res.json()) as GammaEvent[];
    if (!pageData.length) break;

    events.push(...pageData);

    if (pageData.length < GAMMA_LIMIT) break;
    offset += GAMMA_LIMIT;
  }

  return events;
}

export async function fetchClobBook(tokenId: string): Promise<ClobBook | null> {
  try {
    const res = await fetch(`${CLOB_API}/book?token_id=${encodeURIComponent(tokenId)}`);
    if (!res.ok) return null;
    return (await res.json()) as ClobBook;
  } catch {
    return null;
  }
}

// Smoke check: verify Polymarket's per-market fee rate matches our hardcoded
// SPORTS_FEE_RATE for one representative conditionId. If Polymarket ever ships
// a sports market with a non-standard rate (promotional, category change, etc.)
// this surfaces it loudly so we can update SPORTS_FEE_RATE. Network failures
// are silent — can't verify, but we trust the hardcode.
async function smokeCheckSportsFeeRate(conditionId: string): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SMOKE_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${CLOB_API}/clob-markets/${encodeURIComponent(conditionId)}`,
      { signal: ctrl.signal },
    );
    if (!res.ok) return;
    const info = (await res.json()) as ClobMarketInfo;
    const observed = info.fd?.r;
    if (typeof observed !== 'number') return;
    if (Math.abs(observed - SPORTS_FEE_RATE) > 1e-9) {
      log.warn(
        { conditionId, observed, hardcoded: SPORTS_FEE_RATE },
        'fee rate mismatch — update SPORTS_FEE_RATE',
      );
    }
  } catch {
    // network error — can't verify, fall back to hardcode silently
  } finally {
    clearTimeout(timer);
  }
}

async function fetchClobBooksForTokens(
  tokenIds: string[],
): Promise<Map<string, ClobBook>> {
  const result = new Map<string, ClobBook>();
  for (let i = 0; i < tokenIds.length; i += CLOB_BATCH_SIZE) {
    const batch = tokenIds.slice(i, i + CLOB_BATCH_SIZE);
    const books = await Promise.allSettled(batch.map((id) => fetchClobBook(id)));

    for (let j = 0; j < batch.length; j++) {
      const settled = books[j];
      if (settled.status === 'fulfilled' && settled.value) {
        result.set(batch[j], settled.value);
      }
    }

    if (i + CLOB_BATCH_SIZE < tokenIds.length) {
      await sleep(CLOB_BATCH_DELAY_MS);
    }
  }

  return result;
}

export function buildOutcomeFromBook(
  label: string,
  book: ClobBook | undefined,
  fallbackPrice: number,
  fallbackLiquidity: number,
  feeRate: number = 0,
): OutcomeOdds {
  if (!book || !book.asks.length) {
    return {
      label,
      impliedOdds: applyFee(fallbackPrice, feeRate),
      liquidityDepth: { availableSize: fallbackLiquidity, topLevels: [] },
    };
  }

  const sortedAsks = [...book.asks].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

  const topLevels = sortedAsks
    .slice(0, TOP_LEVELS)
    .map((a) => ({ odds: applyFee(parseFloat(a.price), feeRate), size: parseFloat(a.size) * parseFloat(a.price) }));

  const availableSize = sortedAsks.reduce((sum, a) => sum + parseFloat(a.size) * parseFloat(a.price), 0);
  const bestOdds = topLevels[0]?.odds ?? applyFee(fallbackPrice, feeRate);

  return {
    label,
    impliedOdds: bestOdds,
    liquidityDepth: { availableSize, topLevels },
  };
}

/**
 * Extract the game start time from an event.
 * Prefers gameStartTime on the first sub-market (format: "YYYY-MM-DD HH:MM:SS+00"),
 * which Polymarket sets to the actual kickoff time for all sports.
 * Falls back to endDate/startDate if absent.
 */
function startTimeFromEvent(event: GammaEvent): Date {
  const raw = event.markets.find((m) => m.gameStartTime)?.gameStartTime;
  if (raw) {
    // Convert PostgreSQL-style "2026-04-17 18:20:00+00" to ISO "2026-04-17T18:20:00+00:00"
    const iso = raw.replace(' ', 'T').replace(/\+00$/, '+00:00');
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(event.endDate ?? event.startDate);
}

/**
 * Extract [homeTeam, awayTeam] from a game event title.
 * Handles any league prefix ("EPL: ", "UCL: ") and any " - SUFFIX" (e.g. " - Goals").
 *
 * Polymarket's title ordering is league-dependent. Per the /sports endpoint:
 *  - 'home' ordering (soccer): "HomeTeam vs AwayTeam" — home is first.
 *  - 'away' ordering (NBA/MLB/NHL/NFL): "AwayTeam vs HomeTeam" — away is
 *    first (the US "visitor at host" convention).
 * Caller passes the league's titleOrdering so we always return [home, away]
 * regardless of how the title was framed. This keeps Polymarket's home/away
 * assignment in lockstep with SX (team1 = home).
 */
function extractTeams(
  title: string,
  titleOrdering: 'home' | 'away',
): [string, string] | null {
  const stripped = title
    .replace(/^[^:]+:\s*/, '') // strip "PREFIX: "
    .replace(/\s+-\s+.+$/, ''); // strip " - SUFFIX" — require whitespace on
                                // BOTH sides of the dash so hyphenated team
                                // names like "Paris Saint-Germain FC" are
                                // preserved (the previous \s*-\s* matched the
                                // intra-name hyphen and ate the rest of the
                                // title).
  const match = stripped.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (!match) return null;
  const first = match[1].trim();
  const second = match[2].trim();
  return titleOrdering === 'home' ? [first, second] : [second, first];
}

function isMoneylineMarket(m: GammaMarket): boolean {
  // sportsMarketType is absent on soccer events (no field) and present as 'moneyline' on NBA/MLB.
  // Exclude any non-moneyline type so spread/total questions aren't matched by the 1X2 finders.
  return !m.sportsMarketType || m.sportsMarketType === 'moneyline';
}

function findHomeWinMarket(
  markets: GammaMarket[],
  homeTeam: string,
  awayTeam: string,
): GammaMarket | undefined {
  const homeLower = homeTeam.toLowerCase();
  const awayLower = awayTeam.toLowerCase();

  return markets.find((m) => {
    if (!m.active || m.closed) return false;
    if (!isMoneylineMarket(m)) return false;
    const q = m.question.toLowerCase();
    if (q.includes('draw')) return false;
    const homeIdx = q.indexOf(homeLower);
    if (homeIdx < 0) return false;
    const awayIdx = q.indexOf(awayLower);
    if (awayIdx >= 0) return homeIdx < awayIdx;
    return true;
  });
}

function findAwayWinMarket(
  markets: GammaMarket[],
  homeTeam: string,
  awayTeam: string,
): GammaMarket | undefined {
  const homeLower = homeTeam.toLowerCase();
  const awayLower = awayTeam.toLowerCase();

  return markets.find((m) => {
    if (!m.active || m.closed) return false;
    if (!isMoneylineMarket(m)) return false;
    const q = m.question.toLowerCase();
    if (q.includes('draw')) return false;
    const awayIdx = q.indexOf(awayLower);
    if (awayIdx < 0) return false;
    const homeIdx = q.indexOf(homeLower);
    if (homeIdx >= 0) return awayIdx < homeIdx;
    return true;
  });
}

function findDrawMarket(markets: GammaMarket[]): GammaMarket | undefined {
  return markets.find((m) => {
    if (!m.active || m.closed) return false;
    if (!isMoneylineMarket(m)) return false;
    const q = m.question.toLowerCase();
    return q.includes('draw') || q.includes('tie');
  });
}

// --- Game-lines helpers ---

function eventTitleSuffix(title: string): string {
  const dashIdx = title.indexOf(' - ');
  return dashIdx >= 0 ? title.slice(dashIdx + 3).toLowerCase() : '';
}

// Polymarket uses "- More Markets" as the suffix for all game-lines events.
// Also include legacy keyword patterns in case other formats appear.
const GAME_LINES_SUFFIX_KEYWORDS = [
  'more markets', 'goal', 'total', 'over', 'under', 'handicap', 'spread',
];

function isGameLinesEvent(title: string): boolean {
  const suffix = eventTitleSuffix(title);
  return GAME_LINES_SUFFIX_KEYWORDS.some((kw) => suffix.includes(kw));
}

/**
 * Parse a single binary sub-market from a "More Markets" event.
 * Uses sportsMarketType + line fields (reliable) rather than parsing question text.
 * Outcomes array contains meaningful labels (team names for spreads, Over/Under for totals).
 */
function parseGameLineSubMarket(
  market: GammaMarket,
  sport: string | undefined,
  feeRate: number,
): {
  betType: 'total' | 'spread';
  line: number;
  labelOne: string;
  labelTwo: string;
  tokenOne: string;
  tokenTwo: string;
  fallbackOne: number;
  fallbackTwo: number;
  liquidityEach: number;
  feeRate: number;
} | null {
  if (!market.active || market.closed) return null;

  // Determine bet type from sportsMarketType field; fall back to question text
  let betType: 'total' | 'spread' | null = null;
  if (market.sportsMarketType === 'spreads') betType = 'spread';
  else if (market.sportsMarketType === 'totals') betType = 'total';
  else {
    const q = market.question.toLowerCase();
    if (q.startsWith('spread:')) betType = 'spread';
    else if (q.startsWith('total:') || q.includes('over') || q.includes('under')) betType = 'total';
  }
  if (!betType) return null;

  // Line value comes directly from the market object — no parsing needed
  if (market.line === undefined || market.line === null) return null;
  const lineVal = market.line;

  const tokens = parseJsonField<string>(market.clobTokenIds);
  if (!tokens[0] || !tokens[1]) return null;

  const prices = parseJsonField<string>(market.outcomePrices).map(Number);
  const outcomeLabels = parseJsonField<string>(market.outcomes);
  const liq = parseFloat(market.liquidity ?? '0') / 2;

  const genericLabels = !outcomeLabels[0] || outcomeLabels[0] === 'Yes' || outcomeLabels[0] === 'No';

  let labelOne: string;
  let labelTwo: string;
  const absLine = Math.abs(lineVal);

  if (betType === 'spread') {
    if (!genericLabels && outcomeLabels.length >= 2) {
      // outcomes = ["TeamA", "TeamB"] — team names without handicap suffix
      const team1 = canonicalTeamName(outcomeLabels[0], sport);
      const team2 = canonicalTeamName(outcomeLabels[1], sport);
      // lineVal is from team1's perspective (negative = team1 favoured)
      labelOne = lineVal <= 0 ? `${team1} -${absLine}` : `${team1} +${absLine}`;
      labelTwo = lineVal <= 0 ? `${team2} +${absLine}` : `${team2} -${absLine}`;
    } else {
      // Fallback: parse from question "Spread: TeamA (-1.5)"
      const q = market.question;
      const teamMatch = q.match(/Spread:\s*(.+?)\s*\(/i);
      if (!teamMatch) return null;
      const team1 = canonicalTeamName(teamMatch[1].trim(), sport);
      labelOne = lineVal <= 0 ? `${team1} -${absLine}` : `${team1} +${absLine}`;
      labelTwo = lineVal <= 0 ? `Other +${absLine}` : `Other -${absLine}`;
    }
  } else {
    // Total: line is the goals threshold
    if (!genericLabels && outcomeLabels.length >= 2) {
      const o1Lower = outcomeLabels[0].toLowerCase();
      if (o1Lower.includes('over') || o1Lower.includes('under')) {
        // API may return "Over 2.5" (complete) or bare "Over" (needs line appended)
        const hasNumber = /\d/.test(outcomeLabels[0]);
        labelOne = hasNumber ? outcomeLabels[0] : `${outcomeLabels[0]} ${absLine}`;
        labelTwo = hasNumber ? outcomeLabels[1] : `${outcomeLabels[1]} ${absLine}`;
      } else {
        // Unexpected format — use generic Over/Under
        labelOne = `Over ${absLine}`;
        labelTwo = `Under ${absLine}`;
      }
    } else {
      // Generic Yes/No — infer from question
      const qLower = market.question.toLowerCase();
      if (qLower.includes('under') && !qLower.includes('over')) {
        labelOne = `Under ${absLine}`;
        labelTwo = `Over ${absLine}`;
      } else {
        labelOne = `Over ${absLine}`;
        labelTwo = `Under ${absLine}`;
      }
    }
  }

  return {
    betType,
    line: lineVal,
    labelOne,
    labelTwo,
    tokenOne: tokens[0],
    tokenTwo: tokens[1],
    fallbackOne: prices[0] ?? 0,
    fallbackTwo: prices[1] ?? 0,
    liquidityEach: liq,
    feeRate,
  };
}

export async function fetchPolymarketMarkets(league: LeagueConfig = ACTIVE_LEAGUE): Promise<MarketQuote[]> {
  if (!league.polymarket) return [];
  const allEvents = await fetchLeagueEvents(league);
  if (!allEvents.length) return [];

  // Split: 1X2 match events (no ' - ') vs. potential game-lines events (have ' - ')
  const matchEvents = allEvents.filter((e) => !e.title.includes(' - '));
  const gameLinesRaw = allEvents.filter((e) => e.title.includes(' - '));

  type Match1x2Entry = {
    event: GammaEvent;
    homeTeam: string;
    awayTeam: string;
    outcomeEntries: OutcomeEntry[];
  };

  type GameLineItem = {
    homeTeam: string;
    awayTeam: string;
    polyEventId: string;
    conditionId: string;
    betType: 'total' | 'spread';
    line: number;
    startTime: Date;
    labelOne: string;
    labelTwo: string;
    tokenOne: string;
    tokenTwo: string;
    fallbackOne: number;
    fallbackTwo: number;
    liquidityEach: number;
    feeRate: number;
  };

  const matchEntries: Match1x2Entry[] = [];
  const glItems: GameLineItem[] = [];
  const allTokenIds: string[] = [];

  // Polymarket V2 sets the fee rate per category, not per market — every sports
  // market shares SPORTS_FEE_RATE. We stamp it directly on each outcome instead
  // of round-tripping /clob-markets per conditionId. The smoke check below
  // verifies the assumption against a single representative market per cycle.
  const feeRateOf = (_m: GammaMarket): number => SPORTS_FEE_RATE;

  // --- Process 1X2 match events ---
  for (const event of matchEvents) {
    const teams = extractTeams(event.title, league.polymarket!.titleOrdering);
    if (!teams) continue;
    const [rawHome, rawAway] = teams;
    const homeTeam = canonicalTeamName(rawHome, league.sport);
    const awayTeam = canonicalTeamName(rawAway, league.sport);

    const outcomeEntries: OutcomeEntry[] = [];

    if (!league.hasDraw) {
      // US sports (NBA/MLB/NHL): ONE combined moneyline market covers both
      // teams. outcomes[i] is the team that wins when token[i] resolves YES.
      // Read outcomes[] directly — don't try to find by question text, since
      // the title-ordering convention can put the home team second (US sports
      // list AWAY first), which breaks any "home first in question" heuristic.
      const mlMarket = event.markets.find((m) => m.active && !m.closed && isMoneylineMarket(m));
      if (!mlMarket) continue;
      const tokens = parseJsonField<string>(mlMarket.clobTokenIds);
      const prices = parseJsonField<string>(mlMarket.outcomePrices).map(Number);
      const outcomeLabels = parseJsonField<string>(mlMarket.outcomes);
      const liq = parseFloat(mlMarket.liquidity) / 2;
      const feeRate = feeRateOf(mlMarket);
      for (let i = 0; i < 2; i++) {
        if (!tokens[i]) continue;
        const rawTeam = outcomeLabels[i] ?? '';
        const teamName = canonicalTeamName(rawTeam, league.sport);
        outcomeEntries.push({
          label: teamName,
          tokenId: tokens[i],
          fallbackPrice: prices[i] ?? 0,
          liquidity: liq,
          feeRate,
        });
        allTokenIds.push(tokens[i]);
      }
    } else {
      // Soccer (1x2): separate binary markets per outcome — one for "home
      // wins?", one for "draw?", one for "away wins?". Each market's token[0]
      // is YES for the question, token[1] is NO. The "find by question text"
      // heuristic correctly identifies which sub-market is which.
      const homeWinMarket = findHomeWinMarket(event.markets, rawHome, rawAway);
      if (!homeWinMarket) continue;
      const tokens = parseJsonField<string>(homeWinMarket.clobTokenIds);
      const prices = parseJsonField<string>(homeWinMarket.outcomePrices).map(Number);
      const liq = parseFloat(homeWinMarket.liquidity) / 2;
      const feeRate = feeRateOf(homeWinMarket);
      if (tokens[0]) {
        outcomeEntries.push({
          label: homeTeam,
          tokenId: tokens[0],
          fallbackPrice: prices[0] ?? 0,
          liquidity: liq,
          feeRate,
        });
        allTokenIds.push(tokens[0]);
      }
      if (tokens[1]) {
        outcomeEntries.push({
          label: `Not ${homeTeam}`,
          tokenId: tokens[1],
          fallbackPrice: prices[1] ?? 0,
          liquidity: liq,
          feeRate,
        });
        allTokenIds.push(tokens[1]);
      }
    }

    if (league.hasDraw) {
      const drawMarket = findDrawMarket(event.markets);
      if (drawMarket) {
        const tokens = parseJsonField<string>(drawMarket.clobTokenIds);
        const prices = parseJsonField<string>(drawMarket.outcomePrices).map(Number);
        const liq = parseFloat(drawMarket.liquidity) / 2;
        const feeRate = feeRateOf(drawMarket);
        if (tokens[0]) {
          outcomeEntries.push({ label: 'Draw', tokenId: tokens[0], fallbackPrice: prices[0] ?? 0, liquidity: liq, feeRate });
          allTokenIds.push(tokens[0]);
        }
        if (tokens[1]) {
          outcomeEntries.push({ label: 'Not Draw', tokenId: tokens[1], fallbackPrice: prices[1] ?? 0, liquidity: liq, feeRate });
          allTokenIds.push(tokens[1]);
        }
      }

      // Soccer only: separate "away team wins" binary market
      const awayWinMarket = findAwayWinMarket(event.markets, rawHome, rawAway);
      if (awayWinMarket) {
        const tokens = parseJsonField<string>(awayWinMarket.clobTokenIds);
        const prices = parseJsonField<string>(awayWinMarket.outcomePrices).map(Number);
        const liq = parseFloat(awayWinMarket.liquidity) / 2;
        const feeRate = feeRateOf(awayWinMarket);
        if (tokens[0]) {
          outcomeEntries.push({ label: awayTeam, tokenId: tokens[0], fallbackPrice: prices[0] ?? 0, liquidity: liq, feeRate });
          allTokenIds.push(tokens[0]);
        }
        if (tokens[1]) {
          outcomeEntries.push({ label: `Not ${awayTeam}`, tokenId: tokens[1], fallbackPrice: prices[1] ?? 0, liquidity: liq, feeRate });
          allTokenIds.push(tokens[1]);
        }
      }
    }

    if (outcomeEntries.length === 0) continue;
    matchEntries.push({ event, homeTeam, awayTeam, outcomeEntries });
  }

  // --- Extract embedded spread/total markets from match events (NBA/MLB pattern) ---
  // Soccer keeps spread/total in separate " - More Markets" events; NBA/MLB embed them
  // as sub-markets (sportsMarketType='spreads'/'totals') inside the same event as the moneyline.
  const EMBEDDED_GL_TYPES = new Set(['spreads', 'totals']);
  for (const event of matchEvents) {
    const teams = extractTeams(event.title, league.polymarket!.titleOrdering);
    if (!teams) continue;
    const [rawHome, rawAway] = teams;
    const homeTeam = canonicalTeamName(rawHome, league.sport);
    const awayTeam = canonicalTeamName(rawAway, league.sport);
    const startTime = startTimeFromEvent(event);

    for (const subMarket of event.markets) {
      if (!EMBEDDED_GL_TYPES.has(subMarket.sportsMarketType ?? '')) continue;
      const parsed = parseGameLineSubMarket(subMarket, league.sport, feeRateOf(subMarket));
      if (!parsed) continue;

      allTokenIds.push(parsed.tokenOne, parsed.tokenTwo);
      glItems.push({
        homeTeam, awayTeam,
        polyEventId: event.id,
        conditionId: subMarket.conditionId,
        betType: parsed.betType, line: parsed.line, startTime,
        labelOne: parsed.labelOne, labelTwo: parsed.labelTwo,
        tokenOne: parsed.tokenOne, tokenTwo: parsed.tokenTwo,
        fallbackOne: parsed.fallbackOne, fallbackTwo: parsed.fallbackTwo,
        liquidityEach: parsed.liquidityEach, feeRate: parsed.feeRate,
      });
    }
  }

  // --- Process game-lines events ---
  for (const event of gameLinesRaw) {
    if (!isGameLinesEvent(event.title)) continue;

    const teams = extractTeams(event.title, league.polymarket!.titleOrdering);
    if (!teams) continue;
    const [rawHome, rawAway] = teams;
    const homeTeam = canonicalTeamName(rawHome, league.sport);
    const awayTeam = canonicalTeamName(rawAway, league.sport);
    const startTime = startTimeFromEvent(event);

    for (const subMarket of event.markets) {
      const parsed = parseGameLineSubMarket(subMarket, league.sport, feeRateOf(subMarket));
      if (!parsed) continue;

      allTokenIds.push(parsed.tokenOne, parsed.tokenTwo);
      glItems.push({
        homeTeam, awayTeam,
        polyEventId: event.id,
        conditionId: subMarket.conditionId,
        betType: parsed.betType, line: parsed.line, startTime,
        labelOne: parsed.labelOne, labelTwo: parsed.labelTwo,
        tokenOne: parsed.tokenOne, tokenTwo: parsed.tokenTwo,
        fallbackOne: parsed.fallbackOne, fallbackTwo: parsed.fallbackTwo,
        liquidityEach: parsed.liquidityEach, feeRate: parsed.feeRate,
      });
    }
  }

  // Register per-token fee rates onto the WS caches so live frames (price_change /
  // best_bid_ask) apply the correct rate locally without an extra RPC per tick.
  for (const entry of matchEntries) {
    for (const oe of entry.outcomeEntries) {
      polymarketBookCache.setFeeRate(oe.tokenId, oe.feeRate);
      polymarketOddsCache.setFeeRate(oe.tokenId, oe.feeRate);
    }
  }
  for (const gl of glItems) {
    polymarketBookCache.setFeeRate(gl.tokenOne, gl.feeRate);
    polymarketBookCache.setFeeRate(gl.tokenTwo, gl.feeRate);
    polymarketOddsCache.setFeeRate(gl.tokenOne, gl.feeRate);
    polymarketOddsCache.setFeeRate(gl.tokenTwo, gl.feeRate);
  }

  // Fetch all CLOB books in one pass (1X2 + game-lines combined)
  const bookMap = await fetchClobBooksForTokens(allTokenIds);

  const quotes: MarketQuote[] = [];

  // --- Build 1X2 quotes ---
  for (const entry of matchEntries) {
    const outcomes: OutcomeOdds[] = [];
    for (const oe of entry.outcomeEntries) {
      const o = buildOutcomeFromBook(oe.label, bookMap.get(oe.tokenId), oe.fallbackPrice, oe.liquidity, oe.feeRate);
      o.externalId = oe.tokenId;
      outcomes.push(o);
    }

    quotes.push({
      platform: 'polymarket',
      externalId: entry.event.id,
      sport: league.sport,
      league: league.name,
      homeTeam: entry.homeTeam,
      awayTeam: entry.awayTeam,
      name: `${entry.homeTeam} vs ${entry.awayTeam}`,
      startTime: startTimeFromEvent(entry.event),
      betType: league.hasDraw ? '1x2' : '12',
      polyEventId: entry.event.id,
      outcomes,
    });
  }

  // --- Build game-lines quotes ---
  // mainLine: false — Polymarket has no concept of a primary line; all appear in "More Lines" screens
  for (const gl of glItems) {
    const outcomeOne = buildOutcomeFromBook(gl.labelOne, bookMap.get(gl.tokenOne), gl.fallbackOne, gl.liquidityEach, gl.feeRate);
    outcomeOne.externalId = gl.tokenOne;

    const outcomeTwo = buildOutcomeFromBook(gl.labelTwo, bookMap.get(gl.tokenTwo), gl.fallbackTwo, gl.liquidityEach, gl.feeRate);
    outcomeTwo.externalId = gl.tokenTwo;

    quotes.push({
      platform: 'polymarket',
      externalId: gl.conditionId,
      sport: league.sport,
      league: league.name,
      homeTeam: gl.homeTeam,
      awayTeam: gl.awayTeam,
      name: `${gl.homeTeam} vs ${gl.awayTeam}`,
      startTime: gl.startTime,
      betType: gl.betType,
      line: gl.line,
      mainLine: false,
      polyEventId: gl.polyEventId,
      outcomes: [outcomeOne, outcomeTwo],
    });
  }

  const glCount = quotes.filter((q) => q.betType !== '1x2').length;
  log.info(
    { league: league.name, total: quotes.length, oneXTwo: quotes.length - glCount, gameLines: glCount, booksFetched: bookMap.size, booksRequested: allTokenIds.length },
    'fetched quotes',
  );

  // Fire-and-forget smoke check using the first available conditionId.
  // Matches one Polymarket /clob-markets call per league per cycle (vs. ~700 with the old design).
  const sampleConditionId =
    matchEntries[0]?.event.markets[0]?.conditionId ?? glItems[0]?.conditionId;
  if (sampleConditionId) {
    void smokeCheckSportsFeeRate(sampleConditionId);
  }

  return quotes;
}
