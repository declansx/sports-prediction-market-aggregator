import { Router, Request, Response } from 'express';
import { getMarketGroups, type MarketGroup } from '../services/marketGroups';
import { orderBookCache } from '../services/orderBookCache';
import { polymarketBookCache } from '../services/polymarketBookCache';
import { warmMarketBook } from '../services/centrifugo';
import { warmPolyBook } from '../services/polymarketWs';
import { createLogger } from '../logger';

const WARM_TIMEOUT_MS = 5_000;

const log = createLogger('stats');
const router = Router();

// Live ladders. SX externalId is `${marketHash}:${side}` (side 0/1). Poly
// externalId is the CLOB token id directly. The book caches are populated
// lazily by warm helpers — call `warmGroupBooks` first or this returns empty.
function liveLevelsFor(
  platform: 'sx' | 'polymarket',
  externalId: string | null,
): Array<{ odds: number; size: number }> {
  if (!externalId) return [];
  if (platform === 'sx') {
    const sep = externalId.lastIndexOf(':');
    if (sep === -1) return [];
    const marketHash = externalId.slice(0, sep);
    const side = externalId.slice(sep + 1);
    const sides = orderBookCache.getLevels(marketHash);
    return side === '0' ? sides.outcomeOne : side === '1' ? sides.outcomeTwo : [];
  }
  return polymarketBookCache.getLevels(externalId);
}

// Lazy-warms the per-market book caches for every outcome in the supplied
// groups. The book caches are populated on demand — without this, stats
// endpoints get empty ladders for any market the dashboard hasn't already
// opened. By default warms all bet types so both donuts (match-winner and
// all-types) get real-time edge depth; pass matchWinnerOnly=true to skip
// spread/total/alt outcomes when the caller only needs the match-winner edge.
// Times out so a stuck REST call can't hang the response.
async function warmGroupBooks(groups: MarketGroup[], matchWinnerOnly = false): Promise<void> {
  const sxHashes = new Set<string>();
  const polyTokens = new Set<string>();
  for (const g of groups) {
    for (const o of g.outcomes) {
      if (matchWinnerOnly && !MATCH_WINNER_BET_TYPES.has(o.betType)) continue;
      if (!o.externalId) continue;
      if (o.platform === 'sx') {
        const sep = o.externalId.lastIndexOf(':');
        if (sep === -1) continue;
        const hash = o.externalId.slice(0, sep);
        const sides = orderBookCache.getLevels(hash);
        if (sides.outcomeOne.length === 0 && sides.outcomeTwo.length === 0) sxHashes.add(hash);
      } else if (o.platform === 'polymarket') {
        if (polymarketBookCache.getLevels(o.externalId).length === 0) polyTokens.add(o.externalId);
      }
    }
  }
  const jobs: Promise<void>[] = [];
  for (const h of sxHashes) jobs.push(warmMarketBook(h).catch(() => undefined));
  for (const t of polyTokens) jobs.push(warmPolyBook(t).catch(() => undefined));
  if (jobs.length === 0) return;
  await Promise.race([
    Promise.all(jobs).then(() => undefined),
    new Promise<void>((res) => setTimeout(res, WARM_TIMEOUT_MS)),
  ]);
}

export interface BestOddsCount {
  sx: number;
  poly: number;
  total: number;
}

// Average dollar size sitting on the winning venue's ladder at odds strictly
// better than the losing venue's best price, across the outcomes the winner
// won. Null when there's no clear winner (e.g. zero-sample slice).
export interface WinnerEdgeDepth {
  venue: 'sx' | 'poly';
  avgSize: number;
  sampleCount: number;
}

export interface MarketStatsResponse {
  // Matched-only universe for the next 24h. Coverage-wins are not interesting
  // as a pricing stat, so we no longer expose the "all games" variants.
  bestOddsMatched24h: BestOddsCount;
  bestOddsAllMatched24h: BestOddsCount;
  edgeMatched24h: WinnerEdgeDepth | null;
  edgeAllMatched24h: WinnerEdgeDepth | null;
}

// "Match winner" = head-to-head pick. Polymarket has no `mainLine` flag, so we
// filter by bet type. `12` is moneyline (Home/Away). `1x2` is three-way
// (Home/Draw/Away), exposed by Polymarket as 6 yes/no outcomes.
const MATCH_WINNER_BET_TYPES = new Set(['12', '1x2']);

/**
 * Compare match-winner or all-type outcomes per canonical bet across
 * platforms. Both sides → lower implied wins (better decimal odds; tie → sx).
 *
 * In match-winner mode, canonicals present on only one side are skipped: every
 * game on both platforms should have the same match-winner outcomes, so a
 * one-sided canonical is a data-hygiene artifact (canonicalization gap), not
 * real coverage. In all-types mode, one-sided canonicals count as coverage
 * wins for the side that has them — SX exposes alt lines Poly doesn't, and
 * that's a meaningful signal.
 *
 * Outcomes without a canonicalKey are always excluded — without one, there's
 * no cross-platform link, and a label-only join would produce phantom matches
 * from spelling differences (e.g. "Bolívar" vs "Club Bolivar").
 */
export function computeBestOddsCount(groups: MarketGroup[], matchWinnerOnly: boolean): BestOddsCount {
  let sx = 0;
  let poly = 0;

  for (const group of groups) {
    // Resolve marketId → eventId so the canonical join uses (eventId,
    // canonicalKey) — the same shape as the debug pair list. Without the
    // eventId axis, two real games sharing a 6h time bucket and team-pair
    // would collapse, double-counting their canonicals.
    const eventByMarket = new Map<string, string>();
    for (const m of group.markets) eventByMarket.set(m.id, m.eventId);

    const outcomes = matchWinnerOnly
      ? group.outcomes.filter((o) => MATCH_WINNER_BET_TYPES.has(o.betType))
      : group.outcomes;

    // Track the BEST price per side per (eventId, canonicalKey).
    const sxByKey = new Map<string, number>();
    const polyByKey = new Map<string, number>();

    for (const o of outcomes) {
      if (!(o.impliedOdds > 0)) continue;
      if (!o.canonicalKey) continue;
      const eventId = eventByMarket.get(o.marketId);
      if (!eventId) continue;
      const key = `${eventId}|${o.canonicalKey}`;
      const map = o.platform === 'sx' ? sxByKey : o.platform === 'polymarket' ? polyByKey : null;
      if (!map) continue;
      const existing = map.get(key);
      if (existing === undefined || o.impliedOdds < existing) {
        map.set(key, o.impliedOdds);
      }
    }

    const keys = new Set([...sxByKey.keys(), ...polyByKey.keys()]);

    for (const key of keys) {
      const sxOdds = sxByKey.get(key);
      const polyOdds = polyByKey.get(key);
      if (sxOdds === undefined && polyOdds === undefined) continue;
      if (matchWinnerOnly && (sxOdds === undefined || polyOdds === undefined)) continue;
      if (polyOdds === undefined) sx++;
      else if (sxOdds === undefined) poly++;
      else if (sxOdds <= polyOdds) sx++;
      else poly++;
    }
  }

  return { sx, poly, total: sx + poly };
}

function isMatched(group: MarketGroup): boolean {
  const platforms = new Set(group.markets.map((m) => m.platform));
  return platforms.has('sx') && platforms.has('polymarket');
}

// ─── Edge depth ──────────────────────────────────────────────────────────────

export interface MatchedPairInput {
  canonicalKey: string;
  sxOdds: number;
  polyOdds: number;
  sxLevels: Array<{ odds: number; size: number }>;
  polyLevels: Array<{ odds: number; size: number }>;
}

/**
 * For the venue declared `winner`, compute the average dollar size that venue
 * had at prices strictly better than the loser's best across pairs where the
 * winner priced better. "Better" = lower implied probability = higher decimal
 * odds for the bettor. Pairs where the loser priced better are not in the
 * sample. Returns null when the winner has no winning pairs.
 *
 * The winner is supplied externally (from the bar's BestOddsCount) so the edge
 * stat stays visually consistent with the count bars even though the
 * canonical-pair subset can have a different SX/Poly distribution than the
 * broader matched-outcome set.
 */
export function computeWinnerEdge(
  pairs: MatchedPairInput[],
  winner: 'sx' | 'poly',
): WinnerEdgeDepth | null {
  if (pairs.length === 0) return null;
  const samples: number[] = [];
  for (const p of pairs) {
    if (winner === 'sx' && p.sxOdds < p.polyOdds) {
      const size = p.sxLevels
        .filter((l) => l.odds < p.polyOdds)
        .reduce((acc, l) => acc + l.size, 0);
      samples.push(size);
    } else if (winner === 'poly' && p.polyOdds < p.sxOdds) {
      const size = p.polyLevels
        .filter((l) => l.odds < p.sxOdds)
        .reduce((acc, l) => acc + l.size, 0);
      samples.push(size);
    }
  }
  if (samples.length === 0) return null;
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  return { venue: winner, avgSize: avg, sampleCount: samples.length };
}

function pickWinner(counts: BestOddsCount): 'sx' | 'poly' | null {
  if (counts.total === 0) return null;
  return counts.sx >= counts.poly ? 'sx' : 'poly';
}

function edgeFor(
  pairs: MatchedPairInput[],
  counts: BestOddsCount,
): WinnerEdgeDepth | null {
  const winner = pickWinner(counts);
  if (!winner) return null;
  return computeWinnerEdge(pairs, winner);
}

// ─── Endpoint helpers ────────────────────────────────────────────────────────

/**
 * Build matched pairs from live MarketGroups, joining on eventId|canonicalKey.
 * Levels come from the in-memory order book caches (SX: orderBookCache, Poly:
 * polymarketBookCache), so edge depth reflects what's actually on the ladder
 * right now — not whatever was last persisted to DB minutes ago.
 */
function buildPairsFromGroups(groups: MarketGroup[], matchWinnerOnly: boolean): MatchedPairInput[] {
  type Side = { odds: number; levels: Array<{ odds: number; size: number }> };
  const grouped = new Map<string, { sx: Side[]; poly: Side[] }>();

  for (const g of groups) {
    const eventByMarket = new Map<string, string>();
    for (const m of g.markets) eventByMarket.set(m.id, m.eventId);

    for (const o of g.outcomes) {
      if (matchWinnerOnly && !MATCH_WINNER_BET_TYPES.has(o.betType)) continue;
      if (!o.canonicalKey) continue;
      if (!(o.impliedOdds > 0)) continue;
      const eventId = eventByMarket.get(o.marketId);
      if (!eventId) continue;
      const groupKey = `${eventId}|${o.canonicalKey}`;
      let entry = grouped.get(groupKey);
      if (!entry) {
        entry = { sx: [], poly: [] };
        grouped.set(groupKey, entry);
      }
      const side: Side = { odds: o.impliedOdds, levels: liveLevelsFor(o.platform, o.externalId) };
      if (o.platform === 'sx') entry.sx.push(side);
      else if (o.platform === 'polymarket') entry.poly.push(side);
    }
  }

  const pairs: MatchedPairInput[] = [];
  for (const [canonicalKey, { sx, poly }] of grouped) {
    if (sx.length === 0 || poly.length === 0) continue;
    const sxBest = sx.reduce((a, b) => (b.odds < a.odds ? b : a));
    const polyBest = poly.reduce((a, b) => (b.odds < a.odds ? b : a));
    pairs.push({
      canonicalKey,
      sxOdds: sxBest.odds,
      polyOdds: polyBest.odds,
      sxLevels: sxBest.levels,
      polyLevels: polyBest.levels,
    });
  }
  return pairs;
}

router.get('/api/stats/markets', async (_req: Request, res: Response) => {
  try {
    const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const matched24h = (await getMarketGroups()).filter(
      (g) => g.startTime <= cutoff && isMatched(g),
    );

    // Live-overlaid MarketGroups feed both counts and edge ladders so the donut
    // and edge depth reflect actionable prices, not a 30s-stale DB snapshot.
    const bestOddsMatched24h = computeBestOddsCount(matched24h, true);
    const bestOddsAllMatched24h = computeBestOddsCount(matched24h, false);

    await warmGroupBooks(matched24h);
    const edgeMatched24h = edgeFor(buildPairsFromGroups(matched24h, true), bestOddsMatched24h);
    const edgeAllMatched24h = edgeFor(buildPairsFromGroups(matched24h, false), bestOddsAllMatched24h);

    const response: MarketStatsResponse = {
      bestOddsMatched24h,
      bestOddsAllMatched24h,
      edgeMatched24h,
      edgeAllMatched24h,
    };

    res.json(response);
  } catch (err) {
    log.error({ err }, 'failed to compute market stats');
    res.status(500).json({ error: 'internal_server_error' });
  }
});

export default router;
