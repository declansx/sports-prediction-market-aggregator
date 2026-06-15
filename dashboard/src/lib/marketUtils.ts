import { type Market } from './api';

export interface MatchGroup {
  name: string;
  sport: string;
  league: string;
  startTime: string;
  sxEventId?: string;
  outcomes: OutcomeRow[];
}

export interface OutcomeRow {
  id: string;
  label: string;
  betType?: string;
  line?: number | null;
  sx?: { impliedOdds: number; availableSize: number };
  polymarket?: { impliedOdds: number; availableSize: number };
  outcomeId: string;
  mainLine: boolean;
  canonicalKey: string | null;
  // Precise per-venue book pointers (PublicOutcome.externalId) for the public
  // read-only orderbook endpoint: SX "${marketHash}:${side}", Poly tokenId.
  // First sibling seen per venue wins (any one is a valid book pointer).
  sxBook?: string;
  polyBook?: string;
}

function outcomeMergeKey(
  canonicalKey: string | null | undefined,
  betType: string | undefined,
  line: number | null | undefined,
  label: string,
): string {
  if (canonicalKey) return `c|${canonicalKey}`;
  return `l|${betType ?? ''}|${line ?? ''}|${label}`;
}

function mergePlatformOdds(
  existing: { impliedOdds: number; availableSize: number } | undefined,
  next: { impliedOdds: number; availableSize: number },
): { impliedOdds: number; availableSize: number } {
  if (!existing) return { ...next };
  // Best odds win (lowest implied probability = highest payout). Sum size
  // across siblings on the same platform (per-team binary markets on Poly,
  // opposite-direction spread markets on SX).
  const better = next.impliedOdds > 0 && (existing.impliedOdds === 0 || next.impliedOdds < existing.impliedOdds);
  return {
    impliedOdds: better ? next.impliedOdds : existing.impliedOdds,
    availableSize: existing.availableSize + next.availableSize,
  };
}

export interface BetSlipSelection {
  outcomeId: string;
  label: string;
  matchName: string;
  // Carried only for the public read-only build, where the orderbook endpoint
  // takes precise book pointers instead of a DB outcome id.
  sxBook?: string;
  polyBook?: string;
}

export function matchGroupKey(
  name: string,
  sport: string,
  league: string,
  startTime: string,
): string {
  const parts = name.split(' vs ');
  const teamKey = parts.length === 2 ? [...parts].sort().join('\x00') : name;
  // Bucket by 6 hours so same-game SX/Poly events (which can have slightly
  // different startTimes due to platform reporting) merge while DIFFERENT
  // games (e.g. a 3-game series on consecutive days) stay separate.
  const t = new Date(startTime).getTime();
  const bucket = Math.floor(t / (6 * 60 * 60 * 1000));
  return `${sport}\x01${league}\x01${teamKey}\x01${bucket}`;
}

export function groupMarkets(markets: Market[]): MatchGroup[] {
  const byKey = new Map<string, MatchGroup>();

  for (const m of markets) {
    const key = matchGroupKey(m.name, m.sport, m.league, m.startTime);
    if (!byKey.has(key)) {
      byKey.set(key, {
        name: m.name,
        sport: m.sport,
        league: m.league,
        startTime: m.startTime,
        sxEventId: m.sxEventId ?? undefined,
        outcomes: [],
      });
    }
    const group = byKey.get(key)!;
    if (!group.sxEventId && m.sxEventId) group.sxEventId = m.sxEventId;

    for (const o of m.outcomes) {
      const key = outcomeMergeKey(o.canonicalKey, m.betType, m.line, o.label);
      let existing = group.outcomes.find(
        (x) => outcomeMergeKey(x.canonicalKey, x.betType, x.line, x.label) === key,
      );
      if (!existing) {
        existing = {
          id: o.id,
          label: o.label,
          betType: m.betType,
          line: m.line ?? null,
          outcomeId: o.id,
          mainLine: false,
          canonicalKey: o.canonicalKey ?? null,
        };
        group.outcomes.push(existing);
      }
      if (m.mainLine) existing.mainLine = true;
      const next = { impliedOdds: o.impliedOdds, availableSize: o.availableSize };
      if (m.platform === 'sx') {
        existing.sx = mergePlatformOdds(existing.sx, next);
        if (o.externalId && !existing.sxBook) existing.sxBook = o.externalId;
      } else {
        existing.polymarket = mergePlatformOdds(existing.polymarket, next);
        if (o.externalId && !existing.polyBook) existing.polyBook = o.externalId;
        // Only switch the trade-target outcomeId to a Poly id if we still
        // have no SX outcome on this row (router can route from either).
        if (!existing.sx) existing.outcomeId = o.id;
      }
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
}

export function getBestOdds(row: OutcomeRow): {
  platform: 'sx' | 'polymarket';
  impliedOdds: number;
  availableSize: number;
} | null {
  const sxValid = row.sx && row.sx.impliedOdds > 0;
  const polyValid = row.polymarket && row.polymarket.impliedOdds > 0;

  if (sxValid && polyValid) {
    return row.sx!.impliedOdds <= row.polymarket!.impliedOdds
      ? { platform: 'sx', ...row.sx! }
      : { platform: 'polymarket', ...row.polymarket! };
  }
  if (sxValid) return { platform: 'sx', ...row.sx! };
  if (polyValid) return { platform: 'polymarket', ...row.polymarket! };
  if (row.sx) return { platform: 'sx', ...row.sx };
  if (row.polymarket) return { platform: 'polymarket', ...row.polymarket };
  return null;
}

export function get1X2(group: MatchGroup): {
  home: OutcomeRow | null;
  draw: OutcomeRow | null;
  away: OutcomeRow | null;
  notHome: OutcomeRow | null;
  notDraw: OutcomeRow | null;
  notAway: OutcomeRow | null;
} {
  const parts = group.name.split(' vs ').map((s) => s.trim());
  const team1 = parts[0] ?? '';
  const team2 = parts[1] ?? '';
  const find = (label: string) =>
    group.outcomes.find((o) => o.betType === '1x2' && o.label === label) ?? null;
  return {
    home: find(team1),
    draw: find('Draw'),
    away: find(team2),
    notHome: find(`Not ${team1}`),
    notDraw: find('Not Draw'),
    notAway: find(`Not ${team2}`),
  };
}

function sortTotals(outcomes: OutcomeRow[]): OutcomeRow[] {
  const byLine = new Map<number, { over?: OutcomeRow; under?: OutcomeRow }>();
  for (const o of outcomes) {
    const m = o.label.match(/^(Over|Under) (\d+(\.\d+)?)/);
    if (!m) continue;
    const val = parseFloat(m[2]);
    if (!byLine.has(val)) byLine.set(val, {});
    const entry = byLine.get(val)!;
    if (m[1] === 'Over') entry.over = o;
    else entry.under = o;
  }
  const result: OutcomeRow[] = [];
  for (const val of [...byLine.keys()].sort((a, b) => a - b)) {
    const { over, under } = byLine.get(val)!;
    if (over) result.push(over);
    if (under) result.push(under);
  }
  return result;
}

// Returns the home-perspective signed line for a spread outcome, derived from
// canonicalKey when present (preferred) or label parsing as a fallback.
// "Home -1.5" / "Away +1.5" / canonical home:-1.5 / away:+1.5 all map to -1.5.
function homeSignedLine(o: OutcomeRow, team1: string, team2: string): number | null {
  if (o.canonicalKey) {
    const m = o.canonicalKey.match(/^spread:(home|away):([+-]?\d+(?:\.\d+)?)$/);
    if (m) {
      const signed = parseFloat(m[2]);
      return m[1] === 'home' ? signed : -signed;
    }
  }
  const m = o.label.match(/([+-]\d+(\.\d+)?)$/);
  if (!m) return null;
  const val = parseFloat(m[1]);
  if (o.label.startsWith(team1)) return val;
  if (o.label.startsWith(team2)) return -val;
  return null;
}

// Layout: each row is a complementary pair — home -X next to away +X (odds
// sum to ~1). With canonical bets, "home covers -X" and "away covers +X" are
// different canonical keys (spread:home:-X and spread:away:+X) but they're
// the two sides of the same wager. Group by home-perspective signed line so
// they land in the same bucket: home-keyed rows go in .home, away-keyed
// (homeSignedLine flipped) rows go in .away.
function sortHandicaps(outcomes: OutcomeRow[], team1: string, team2: string): OutcomeRow[] {
  const byHomeVal = new Map<number, { home?: OutcomeRow; away?: OutcomeRow }>();
  for (const o of outcomes) {
    const signed = homeSignedLine(o, team1, team2);
    if (signed === null) continue;
    if (!byHomeVal.has(signed)) byHomeVal.set(signed, {});
    const slot = byHomeVal.get(signed)!;
    // Determine "side" by canonical key (preferred) or label prefix.
    const isHomeKey = o.canonicalKey?.startsWith('spread:home:')
      ?? o.label.startsWith(team1);
    if (isHomeKey) slot.home = o;
    else slot.away = o;
  }
  const result: OutcomeRow[] = [];
  for (const val of [...byHomeVal.keys()].sort((a, b) => a - b)) {
    const { home, away } = byHomeVal.get(val)!;
    if (home) result.push(home);
    if (away) result.push(away);
  }
  return result;
}

export function categorizeOutcomes(group: MatchGroup): {
  matchResult: OutcomeRow[];
  totals: OutcomeRow[];
  handicaps: OutcomeRow[];
  others: OutcomeRow[];
} {
  const parts = group.name.split(' vs ').map((s) => s.trim());
  const team1 = parts[0] ?? '';
  const team2 = parts[1] ?? '';

  const matchResult: OutcomeRow[] = [];
  const totals: OutcomeRow[] = [];
  const handicaps: OutcomeRow[] = [];
  const others: OutcomeRow[] = [];

  for (const o of group.outcomes) {
    if (o.betType === '1x2') {
      matchResult.push(o);
    } else if (o.betType === 'total') {
      totals.push(o);
    } else if (o.betType === 'spread') {
      handicaps.push(o);
    } else {
      // Includes betType === '12' (two-way moneyline) and anything else —
      // shown under "Other markets" for soccer detail view.
      others.push(o);
    }
  }

  // Positive outcomes first (1/X/2), then their "Not" counterparts in the same column order
  const order = [team1, 'Draw', team2, `Not ${team1}`, 'Not Draw', `Not ${team2}`];
  matchResult.sort((a, b) => {
    const ai = order.indexOf(a.label);
    const bi = order.indexOf(b.label);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // Sort totals by line value ascending, Over before Under at each line
  const sortedTotals = sortTotals(totals);

  // Sort handicaps by home spread value ascending (most negative first), home before away
  const sortedHandicaps = sortHandicaps(handicaps, team1, team2);

  return { matchResult, totals: sortedTotals, handicaps: sortedHandicaps, others };
}

export function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateHeader(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return 'Today';
  if (same(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

export function pairOutcomes(outcomes: OutcomeRow[]): [OutcomeRow, OutcomeRow | null][] {
  const pairs: [OutcomeRow, OutcomeRow | null][] = [];
  for (let i = 0; i < outcomes.length; i += 2) {
    pairs.push([outcomes[i], outcomes[i + 1] ?? null]);
  }
  return pairs;
}

export function isAmericanSport(group: MatchGroup): boolean {
  return group.sport !== 'Soccer';
}

export function getSpreadMLTotal(group: MatchGroup): {
  mlHome: OutcomeRow | null;
  mlAway: OutcomeRow | null;
  spreadHome: OutcomeRow | null;
  spreadAway: OutcomeRow | null;
  totalOver: OutcomeRow | null;
  totalUnder: OutcomeRow | null;
} {
  const parts = group.name.split(' vs ').map((s) => s.trim());
  const team1 = parts[0] ?? '';
  const team2 = parts[1] ?? '';

  // Moneyline comes from the two-way (no-draw) market. For NA sports this is the
  // only binary available; for soccer it exists alongside 1x2 and we want only it.
  const mlHome = group.outcomes.find((o) => o.betType === '12' && o.label === team1) ?? null;
  const mlAway = group.outcomes.find((o) => o.betType === '12' && o.label === team2) ?? null;

  // Spreads: prefer mainLine markets; fall back to all if none marked mainLine.
  // Display layout: home-team-perspective row paired with the away-team-perspective
  // row at the SAME line magnitude (these are complementary outcomes — odds sum
  // to ~1, and they correspond to one canonical "spread bet" with two sides).
  const spreads = group.outcomes.filter((o) => o.betType === 'spread');
  const mainSpreads = spreads.filter((o) => o.mainLine);
  const candidateSpreads = mainSpreads.length > 0 ? mainSpreads : spreads;

  // Pick the home-side row first (label starting with team1, or canonical spread:home:*).
  const homeSpread =
    candidateSpreads.find(
      (o) => o.canonicalKey?.startsWith('spread:home:') || o.label.startsWith(team1),
    ) ?? null;
  let awaySpread: OutcomeRow | null = null;
  if (homeSpread) {
    const homeSigned = homeSignedLine(homeSpread, team1, team2);
    if (homeSigned !== null) {
      // Complement of "home covers L" is "away covers -L". From the home-team
      // frame, both have the SAME homeSignedLine (the away-side row's signed
      // value is negated when computing homeSignedLine). So the complement is
      // the AWAY-keyed (or away-team-prefixed) row at the same homeSignedLine.
      awaySpread =
        candidateSpreads.find((o) => {
          if (o === homeSpread) return false;
          const isAwayKey =
            o.canonicalKey?.startsWith('spread:away:') ?? o.label.startsWith(team2);
          if (!isAwayKey) return false;
          return homeSignedLine(o, team1, team2) === homeSigned;
        }) ?? null;
    }
  } else {
    awaySpread =
      candidateSpreads.find(
        (o) => o.canonicalKey?.startsWith('spread:away:') || o.label.startsWith(team2),
      ) ?? null;
  }

  // Totals: prefer mainLine markets; match Over+Under at the same line value
  const allTotals = group.outcomes.filter((o) => o.betType === 'total');
  const mainTotals = allTotals.filter((o) => o.mainLine);
  const candidateTotals = mainTotals.length > 0 ? mainTotals : allTotals;

  const totalOver = candidateTotals.find((o) => /^Over \d/.test(o.label)) ?? null;
  let totalUnder: OutcomeRow | null = null;
  if (totalOver) {
    const tm = totalOver.label.match(/^Over (\d+(\.\d+)?)/);
    totalUnder = tm
      ? (candidateTotals.find((o) => o.label === `Under ${tm[1]}`) ??
          candidateTotals.find((o) => /^Under \d/.test(o.label)) ??
          null)
      : null;
  } else {
    totalUnder = candidateTotals.find((o) => /^Under \d/.test(o.label)) ?? null;
  }

  return {
    mlHome,
    mlAway,
    spreadHome: homeSpread,
    spreadAway: awaySpread,
    totalOver,
    totalUnder,
  };
}
