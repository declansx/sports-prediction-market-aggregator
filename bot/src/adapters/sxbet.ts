import { config } from '../config';
import type { MarketQuote, OutcomeOdds } from '../types';
import { canonicalTeamName } from './teamNames';
import { type LeagueConfig, ACTIVE_LEAGUE } from '../leagues';
import { createLogger } from '../logger';

const log = createLogger('sxbet');

const BASE_TOKEN = '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B';
const ODDS_PRECISION = BigInt('100000000000000000000'); // 10^20
const USDC_DECIMALS = 1_000_000;
const TOP_LEVELS = 5;
const ORDER_BATCH_SIZE = 30;
const BATCH_DELAY_MS = 600;

interface SxMarket {
  marketHash: string;
  outcomeOneName: string;
  outcomeTwoName: string;
  teamOneName?: string;
  teamTwoName?: string;
  sportId: number;
  sportLabel: string;
  leagueId: number;
  sportXeventId?: string; // e.g. "L18511902" — groups all bet types for the same game
  type: number;
  line?: number; // Handicap or total value for spread/total markets
  mainLine?: boolean; // true if this is the primary line for its type
  gameTime: number; // UNIX timestamp (seconds)
}

interface SxOrder {
  marketHash: string;
  percentageOdds: string;
  totalBetSize: string;
  fillAmount: string;
  isMakerBettingOutcomeOne: boolean;
}

// One entry per game — holds the three 1X2 binary markets
interface GameEntry {
  homeTeam: string;       // canonical
  awayTeam: string;       // canonical
  gameTime: number;
  sportLabel: string;
  sxEventId?: string;     // sportXeventId shared across all bet types for this game
  homeWinMarket?: SxMarket; // outcomeOneName === teamOneName
  drawMarket?: SxMarket;    // outcomeOneName === 'Tie'
  awayWinMarket?: SxMarket; // outcomeOneName === teamTwoName
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string): Promise<Response> {
  const res = await fetch(url);
  if (res.status === 429) {
    log.warn('rate limited, retrying in 10s');
    await sleep(10_000);
    return fetch(url);
  }
  return res;
}

async function fetchAllActiveMarkets(leagueId: number): Promise<SxMarket[]> {
  const markets: SxMarket[] = [];
  let paginationKey: string | undefined;

  do {
    const params = new URLSearchParams({
      pageSize: '50',
      leagueId: String(leagueId),
    });
    if (paginationKey) params.set('paginationKey', paginationKey);

    const res = await fetchWithRetry(`${config.SX_BET_API_URL}/markets/active?${params}`);
    if (!res.ok) throw new Error(`GET /markets/active returned ${res.status}`);

    const body = (await res.json()) as {
      data: { markets: SxMarket[]; nextKey?: string };
    };

    markets.push(...body.data.markets);
    paginationKey = body.data.nextKey || undefined;
  } while (paginationKey);

  return markets;
}

export async function fetchOrdersForHashes(hashes: string[]): Promise<SxOrder[]> {
  const params = new URLSearchParams({
    marketHashes: hashes.join(','),
    baseToken: BASE_TOKEN,
  });
  const url = `${config.SX_BET_API_URL}/orders?${params}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`GET /orders returned ${res.status}`);
  const body = (await res.json()) as { data: SxOrder[] };
  return body.data;
}

export function buildOutcome(
  label: string,
  orders: SxOrder[],
  // takerBettingOutcomeOne=true means taker bets outcomeOne (needs makers on outcomeTwo)
  takerBettingOutcomeOne: boolean,
): OutcomeOdds {
  const relevantOrders = orders.filter(
    (o) => o.isMakerBettingOutcomeOne !== takerBettingOutcomeOne,
  );

  const levelMap = new Map<number, number>();
  let totalAvailableUsdc = 0;

  for (const o of relevantOrders) {
    const makerRemaining = BigInt(o.totalBetSize) - BigInt(o.fillAmount);
    if (makerRemaining <= 0n) continue;

    const takerSpace = (makerRemaining * ODDS_PRECISION) / BigInt(o.percentageOdds) - makerRemaining;
    const takerUsdc = Number(takerSpace) / USDC_DECIMALS;

    const makerImplied = parseFloat(o.percentageOdds) / 1e20;
    const takerOdds = parseFloat((1 - makerImplied).toFixed(8));

    levelMap.set(takerOdds, (levelMap.get(takerOdds) ?? 0) + takerUsdc);
    totalAvailableUsdc += takerUsdc;
  }

  const topLevels = Array.from(levelMap.entries())
    .map(([odds, size]) => ({ odds, size }))
    .sort((a, b) => a.odds - b.odds)  // ascending: lowest implied probability (best payout) first
    .slice(0, TOP_LEVELS);

  const bestOdds = topLevels[0]?.odds ?? 0;

  return {
    label,
    impliedOdds: bestOdds,
    liquidityDepth: { availableSize: totalAvailableUsdc, topLevels },
  };
}

// Types 226/342/28 are the "Including Overtime" equivalents used by NBA/NHL
const GAME_LINE_TYPES = new Set([52, 226, 3, 342, 2, 28]);

function betTypeFromSxType(type: number): string {
  if (type === 52 || type === 226) return '12';
  if (type === 3 || type === 342) return 'spread';
  return 'total'; // types 2, 28
}

// SX returns game-lines outcome names with the platform's full team name (e.g.
// "Paris Saint Germain -1.5"). Replace the team-name prefix with our canonical
// short form so labels match `Event.homeTeam`/`awayTeam` everywhere downstream.
// Totals labels ("Over 2.5" / "Under 2.5") have no team prefix and pass through.
function canonicalizeOutcomeLabel(
  rawLabel: string,
  rawHome: string,
  rawAway: string,
  homeCanonical: string,
  awayCanonical: string,
): string {
  if (rawLabel.startsWith(rawHome)) return homeCanonical + rawLabel.slice(rawHome.length);
  if (rawLabel.startsWith(rawAway)) return awayCanonical + rawLabel.slice(rawAway.length);
  return rawLabel;
}

export async function fetchSxBetMarkets(league: LeagueConfig = ACTIVE_LEAGUE): Promise<MarketQuote[]> {
  const allMarkets = await fetchAllActiveMarkets(league.sxbet.leagueId);
  if (allMarkets.length === 0) {
    log.warn({ league: league.name, leagueId: league.sxbet.leagueId }, 'API returned 0 markets');
    return [];
  }

  const type1Markets = league.hasDraw ? allMarkets.filter(m => m.type === 1) : [];
  const gameLinesMarkets = allMarkets.filter(
    m => GAME_LINE_TYPES.has(m.type) && m.teamOneName && m.teamTwoName,
  );

  // Group the three 1X2 binary markets (home win, draw, away win) by game.
  // Double-chance markets (e.g. "Home or Draw") are ignored — their outcomeOneName
  // won't match teamOneName, teamTwoName, or 'Tie', so they fall through cleanly.
  const gameMap = new Map<string, GameEntry>();

  for (const market of type1Markets) {
    const rawHome = (market.teamOneName ?? '').trim();
    const rawAway = (market.teamTwoName ?? '').trim();
    if (!rawHome || !rawAway) continue;

    const key = `${market.gameTime}|${rawHome}|${rawAway}`;
    if (!gameMap.has(key)) {
      gameMap.set(key, {
        homeTeam: canonicalTeamName(rawHome, league.sport),
        awayTeam: canonicalTeamName(rawAway, league.sport),
        gameTime: market.gameTime,
        sportLabel: market.sportLabel,
        sxEventId: market.sportXeventId,
      });
    }

    const entry = gameMap.get(key)!;
    const o1Lower = market.outcomeOneName.toLowerCase().trim();

    if (o1Lower === rawHome.toLowerCase()) {
      entry.homeWinMarket = market;
    } else if (o1Lower === 'tie') {
      entry.drawMarket = market;
    } else if (o1Lower === rawAway.toLowerCase()) {
      entry.awayWinMarket = market;
    }
    // else: double-chance or unknown variant — skip
  }

  // Collect all market hashes: 1X2 entries + game-lines markets
  const allHashes: string[] = [];
  for (const entry of gameMap.values()) {
    if (entry.homeWinMarket) allHashes.push(entry.homeWinMarket.marketHash);
    if (entry.drawMarket) allHashes.push(entry.drawMarket.marketHash);
    if (entry.awayWinMarket) allHashes.push(entry.awayWinMarket.marketHash);
  }
  for (const m of gameLinesMarkets) allHashes.push(m.marketHash);

  // Fetch orders in batches and index by marketHash
  const ordersMap = new Map<string, SxOrder[]>();

  for (let i = 0; i < allHashes.length; i += ORDER_BATCH_SIZE) {
    const batch = allHashes.slice(i, i + ORDER_BATCH_SIZE);
    const batchNum = Math.floor(i / ORDER_BATCH_SIZE) + 1;

    try {
      const orders = await fetchOrdersForHashes(batch);
      for (const order of orders) {
        const list = ordersMap.get(order.marketHash) ?? [];
        list.push(order);
        ordersMap.set(order.marketHash, list);
      }
    } catch (err) {
      log.error({ err, batchNum }, 'failed to fetch orders batch');
    }

    if (i + ORDER_BATCH_SIZE < allHashes.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  const quotes: MarketQuote[] = [];

  // Build one MarketQuote per game with up to 3 true 1X2 outcomes
  for (const [, entry] of gameMap) {
    // Require at least the home-win binary for a stable externalId
    if (!entry.homeWinMarket) continue;

    const name = `${entry.homeTeam} vs ${entry.awayTeam}`;
    const outcomes: OutcomeOdds[] = [];

    // Outcome: Home Win — taker bets outcomeOne (the home team)
    const homeOrders = ordersMap.get(entry.homeWinMarket.marketHash) ?? [];
    const homeOut = buildOutcome(entry.homeTeam, homeOrders, true);
    // externalId encodes which binary market hash to use when executing:
    // format "${specificMarketHash}:0" means isTakerBettingOutcomeOne=true
    homeOut.externalId = `${entry.homeWinMarket.marketHash}:0`;
    outcomes.push(homeOut);

    // Outcome: Not Home Win — taker bets outcomeTwo on the home-win binary
    const notHomeOut = buildOutcome(`Not ${entry.homeTeam}`, homeOrders, false);
    notHomeOut.externalId = `${entry.homeWinMarket.marketHash}:1`;
    outcomes.push(notHomeOut);

    // Outcome: Draw — taker bets outcomeOne (Tie) on the draw binary
    if (entry.drawMarket) {
      const drawOrders = ordersMap.get(entry.drawMarket.marketHash) ?? [];
      const drawOut = buildOutcome('Draw', drawOrders, true);
      drawOut.externalId = `${entry.drawMarket.marketHash}:0`;
      outcomes.push(drawOut);

      // Outcome: Not Draw — taker bets outcomeTwo on the draw binary
      const notDrawOut = buildOutcome('Not Draw', drawOrders, false);
      notDrawOut.externalId = `${entry.drawMarket.marketHash}:1`;
      outcomes.push(notDrawOut);
    }

    // Outcome: Away Win — taker bets outcomeOne (away team) on the away-win binary
    if (entry.awayWinMarket) {
      const awayOrders = ordersMap.get(entry.awayWinMarket.marketHash) ?? [];
      const awayOut = buildOutcome(entry.awayTeam, awayOrders, true);
      awayOut.externalId = `${entry.awayWinMarket.marketHash}:0`;
      outcomes.push(awayOut);

      // Outcome: Not Away Win — taker bets outcomeTwo on the away-win binary
      const notAwayOut = buildOutcome(`Not ${entry.awayTeam}`, awayOrders, false);
      notAwayOut.externalId = `${entry.awayWinMarket.marketHash}:1`;
      outcomes.push(notAwayOut);
    }

    quotes.push({
      platform: 'sx',
      externalId: entry.homeWinMarket.marketHash, // home-win hash is the game's stable ID
      sport: entry.sportLabel,
      league: league.name,
      homeTeam: entry.homeTeam,
      awayTeam: entry.awayTeam,
      name,
      startTime: new Date(entry.homeWinMarket.gameTime * 1000),
      betType: '1x2',
      mainLine: true,
      sxEventId: entry.sxEventId,
      outcomes,
    });
  }

  // Build one MarketQuote per game-lines binary (types 52, 3, 2).
  // Each of these is a single binary market — outcomeOneName/outcomeTwoName already
  // embed the line value (e.g. "Lakers -3.5" / "Celtics +3.5", "Over 2.5" / "Under 2.5").
  for (const market of gameLinesMarkets) {
    const rawHome = (market.teamOneName ?? '').trim();
    const rawAway = (market.teamTwoName ?? '').trim();
    if (!rawHome || !rawAway) continue;

    const homeTeam = canonicalTeamName(rawHome, league.sport);
    const awayTeam = canonicalTeamName(rawAway, league.sport);
    const orders = ordersMap.get(market.marketHash) ?? [];

    const labelOne = canonicalizeOutcomeLabel(market.outcomeOneName, rawHome, rawAway, homeTeam, awayTeam);
    const labelTwo = canonicalizeOutcomeLabel(market.outcomeTwoName, rawHome, rawAway, homeTeam, awayTeam);

    const outcomeOne = buildOutcome(labelOne, orders, true);
    outcomeOne.externalId = `${market.marketHash}:0`;

    const outcomeTwo = buildOutcome(labelTwo, orders, false);
    outcomeTwo.externalId = `${market.marketHash}:1`;

    quotes.push({
      platform: 'sx',
      externalId: market.marketHash,
      sport: market.sportLabel,
      league: league.name,
      homeTeam,
      awayTeam,
      name: `${homeTeam} vs ${awayTeam}`,
      startTime: new Date(market.gameTime * 1000),
      betType: betTypeFromSxType(market.type),
      line: market.line,
      mainLine: market.mainLine ?? true,
      sxEventId: market.sportXeventId,
      outcomes: [outcomeOne, outcomeTwo],
    });
  }

  const glCount = quotes.filter(q => q.betType !== '1x2').length;
  log.info(
    { league: league.name, total: quotes.length, oneXTwo: quotes.length - glCount, gameLines: glCount, sourceMarkets: allMarkets.length },
    'fetched quotes',
  );
  return quotes;
}
