import { prisma } from '../db';
import { orderBookCache } from '../services/orderBookCache';
import { polymarketBookCache } from '../services/polymarketBookCache';
import { warmMarketBook } from '../services/centrifugo';
import { warmPolyBook } from '../services/polymarketWs';
import type { AllocationPlan, Allocation, Platform } from '../types';

const DEFAULT_MAX_TRADE_SIZE = 100;
const DEFAULT_SLIPPAGE_TOLERANCE = 0.05;
// Bound on how long the orderbook REST handler will wait for a cold-cache seed
// before falling back to whatever it has. Long enough for a typical SX/CLOB
// REST round-trip; short enough that a stuck seed doesn't hang the panel.
const ORDERBOOK_WARM_TIMEOUT_MS = 1500;

interface LiquidityLevel {
  odds: number;
  size: number;
}

/**
 * Pull fresh order-book levels for an outcome:
 *   - SX: live `orderBookCache` keyed by marketHash + side, populated from
 *     Centrifugo. Falls back to DB liquidityLevels when the cache is empty
 *     (e.g. during cold-start before the WS frame arrives).
 *   - Polymarket: live `polymarketBookCache` keyed by clob tokenId, populated
 *     from Polymarket's WS. Falls back to DB liquidityLevels.
 *
 * The router previously read only DB `liquidityLevels`, which the sync cycle
 * refreshes ~every 30s. The bet-slip orderbook in the dashboard, in contrast,
 * uses the live caches via the WS relay — so the displayed price could be
 * better than what the router saw, and small bets routed away from SX even
 * when the SX top-of-book was tighter. Reading live caches here keeps the
 * router's routing decision in lockstep with what the user sees on screen.
 */
function liveLevelsFor(
  platform: Platform,
  externalId: string | null,
  liquidityLevels: string | null,
  currentOdds: number,
  liquidityDepth: number,
): LiquidityLevel[] {
  if (platform === 'sx' && externalId) {
    const idx = externalId.lastIndexOf(':');
    if (idx !== -1) {
      const hash = externalId.slice(0, idx);
      const sideStr = externalId.slice(idx + 1);
      if (sideStr === '0' || sideStr === '1') {
        const sides = orderBookCache.getLevels(hash);
        const live = sideStr === '0' ? sides.outcomeOne : sides.outcomeTwo;
        if (live.length > 0) return live.map((l) => ({ odds: l.odds, size: l.size }));
      }
    }
  } else if (platform === 'polymarket' && externalId) {
    const live = polymarketBookCache.getLevels(externalId);
    if (live.length > 0) return live.map((l) => ({ odds: l.odds, size: l.size }));
  }

  // Fall back to DB liquidityLevels (the periodic snapshot)
  const parsed = parseLevels(liquidityLevels);
  if (parsed.length > 0) return parsed;
  // Last fallback: synthesize a single level from the outcome's
  // (currentOdds, liquidityDepth) so the router can still route something.
  if (liquidityDepth > 0 && currentOdds > 0) {
    return [{ odds: currentOdds, size: liquidityDepth }];
  }
  return [];
}

async function getBotConfigValue(key: string, defaultValue: number): Promise<number> {
  try {
    const row = await prisma.botConfig.findUnique({ where: { key } });
    if (!row) return defaultValue;
    const parsed = parseFloat(row.value);
    return isNaN(parsed) ? defaultValue : parsed;
  } catch {
    return defaultValue;
  }
}

function parseLevels(json: string | null): LiquidityLevel[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as LiquidityLevel[];
  } catch {
    return [];
  }
}

export interface OrderBookLevel {
  odds: number;
  size: number;
  platform: Platform;
}

export interface OrderBookResponse {
  levels: OrderBookLevel[];
  sxMarketHash?: string;
  sxSide?: 0 | 1;
  polyTokenId?: string;
}

interface OutcomeWithMarket {
  id: string;
  label: string;
  externalId: string | null;
  currentOdds: number;
  liquidityDepth: number;
  liquidityLevels: string | null;
  market: { id: string; platform: string; status: string };
}

async function getCanonicalSiblings(primary: OutcomeWithMarket, canonicalBetId: string | null) {
  if (!canonicalBetId) return [primary];
  const all = await prisma.outcome.findMany({
    where: { canonicalBetId, market: { status: 'active' } },
    include: { market: true },
  });
  if (all.length === 0) return [primary];
  return all;
}

function extractSxHashSide(externalId: string | null): { hash?: string; side?: 0 | 1 } {
  if (!externalId) return {};
  const idx = externalId.lastIndexOf(':');
  if (idx === -1) return {};
  const suffix = externalId.slice(idx + 1);
  if (suffix !== '0' && suffix !== '1') return {};
  return { hash: externalId.slice(0, idx), side: suffix === '0' ? 0 : 1 };
}

export async function getOrderBookLevels(primaryOutcomeId: string): Promise<OrderBookResponse> {
  const primaryOutcome = await prisma.outcome.findUnique({
    where: { id: primaryOutcomeId },
    include: { market: true },
  });

  if (!primaryOutcome) return { levels: [] };

  const siblings = await getCanonicalSiblings(primaryOutcome, primaryOutcome.canonicalBetId);

  // Warm any cold live caches before reading levels, so the REST snapshot is
  // the same depth the dashboard's WS feed will deliver moments later. This
  // avoids the "thin REST levels → full WS levels flash" the dashboard used
  // to hide behind a multi-second LOADING gate.
  const warmJobs: Promise<void>[] = [];
  for (const o of siblings) {
    const platform = o.market.platform as Platform;
    if (platform === 'sx' && o.externalId) {
      const idx = o.externalId.lastIndexOf(':');
      if (idx === -1) continue;
      const hash = o.externalId.slice(0, idx);
      const sideStr = o.externalId.slice(idx + 1);
      if (sideStr !== '0' && sideStr !== '1') continue;
      const sides = orderBookCache.getLevels(hash);
      if (sides.outcomeOne.length === 0 && sides.outcomeTwo.length === 0) {
        warmJobs.push(warmMarketBook(hash).catch(() => undefined));
      }
    } else if (platform === 'polymarket' && o.externalId) {
      const live = polymarketBookCache.getLevels(o.externalId);
      if (live.length === 0) {
        warmJobs.push(warmPolyBook(o.externalId).catch(() => undefined));
      }
    }
  }
  if (warmJobs.length > 0) {
    await Promise.race([
      Promise.all(warmJobs),
      new Promise<void>((res) => setTimeout(res, ORDERBOOK_WARM_TIMEOUT_MS)),
    ]);
  }

  const levels: OrderBookLevel[] = [];
  for (const o of siblings) {
    const platform = o.market.platform as Platform;
    const live = liveLevelsFor(
      platform,
      o.externalId,
      o.liquidityLevels,
      o.currentOdds,
      o.liquidityDepth,
    );
    for (const lvl of live) {
      levels.push({ odds: lvl.odds, size: lvl.size, platform });
    }
  }

  levels.sort((a, b) => a.odds - b.odds);

  // SX hash + side from whichever sibling is on SX (any one will do — we want a live book pointer).
  const sxOutcome = siblings.find((o) => o.market.platform === 'sx');
  const { hash: sxMarketHash, side: sxSide } = extractSxHashSide(sxOutcome?.externalId ?? null);

  // Polymarket token id from whichever sibling is on Polymarket. With per-team binary
  // markets, multiple siblings may exist on Polymarket; the first one is fine for the
  // live-book subscription pointer the dashboard uses.
  const polyOutcome = siblings.find((o) => o.market.platform === 'polymarket');
  const polyTokenId = polyOutcome?.externalId ?? undefined;

  return { levels, sxMarketHash, sxSide, polyTokenId };
}

export interface RouterError {
  code: 'size_exceeds_max' | 'slippage_exceeded' | 'outcome_not_found' | 'no_liquidity';
  message: string;
  detail?: { slippage?: number; tolerance?: number };
}

export type RouterResult =
  | { ok: true; plan: AllocationPlan }
  | { ok: false; error: RouterError };

export async function buildAllocationPlan(
  primaryOutcomeId: string,
  side: string,
  size: number,
): Promise<RouterResult> {
  void side;
  const [maxTradeSize, slippageTolerance] = await Promise.all([
    getBotConfigValue('maxTradeSize', DEFAULT_MAX_TRADE_SIZE),
    getBotConfigValue('slippageTolerance', DEFAULT_SLIPPAGE_TOLERANCE),
  ]);

  if (size > maxTradeSize) {
    return {
      ok: false,
      error: { code: 'size_exceeds_max', message: `Size ${size} exceeds maxTradeSize ${maxTradeSize}` },
    };
  }

  const primaryOutcome = await prisma.outcome.findUnique({
    where: { id: primaryOutcomeId },
    include: { market: true },
  });

  if (!primaryOutcome) {
    return { ok: false, error: { code: 'outcome_not_found', message: `Outcome ${primaryOutcomeId} not found` } };
  }

  const siblings = await getCanonicalSiblings(primaryOutcome, primaryOutcome.canonicalBetId);

  interface Candidate {
    outcomeId: string;
    externalOutcomeId: string;
    marketExternalId: string;
    platform: Platform;
    levels: LiquidityLevel[];
    bestOdds: number;
    totalAvailable: number;
  }

  const candidates: Candidate[] = siblings.map((o) => {
    const platform = o.market.platform as Platform;
    const levels = liveLevelsFor(
      platform,
      o.externalId,
      o.liquidityLevels,
      o.currentOdds,
      o.liquidityDepth,
    );
    const totalAvailable = levels.reduce((s, l) => s + l.size, 0);
    const bestOdds = levels.length > 0 ? levels[0].odds : o.currentOdds;
    return {
      outcomeId: o.id,
      externalOutcomeId: o.externalId ?? '',
      marketExternalId: '', // filled below from market lookup
      platform,
      levels,
      bestOdds,
      totalAvailable,
    };
  });

  // Pull the externalId for each candidate's market in one query.
  const marketIds = Array.from(new Set(siblings.map((o) => o.market.id)));
  const markets = await prisma.market.findMany({
    where: { id: { in: marketIds } },
    select: { id: true, externalId: true },
  });
  const marketIdToExternal = new Map(markets.map((m) => [m.id, m.externalId]));
  for (let i = 0; i < candidates.length; i++) {
    candidates[i].marketExternalId = marketIdToExternal.get(siblings[i].market.id) ?? '';
  }

  interface LevelWithSource {
    odds: number;
    size: number;
    candidateIdx: number;
  }

  // liveLevelsFor() already returns either the live cache levels or a
  // synthesized single fallback level (or empty). Just flatten.
  const allLevels: LevelWithSource[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (const lvl of candidates[i].levels) {
      allLevels.push({ odds: lvl.odds, size: lvl.size, candidateIdx: i });
    }
  }

  allLevels.sort((a, b) => a.odds - b.odds);

  if (allLevels.length === 0) {
    return { ok: false, error: { code: 'no_liquidity', message: 'No liquidity available for this outcome' } };
  }

  const globalBestOdds = allLevels[0].odds;
  const perCand = candidates.map(() => ({ filledSize: 0, weightedOddsSum: 0 }));
  let remaining = size;

  for (const lvl of allLevels) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lvl.size);
    perCand[lvl.candidateIdx].filledSize += take;
    perCand[lvl.candidateIdx].weightedOddsSum += lvl.odds * take;
    remaining -= take;
  }

  const totalSize = perCand.reduce((s, c) => s + c.filledSize, 0);
  if (totalSize === 0) {
    return { ok: false, error: { code: 'no_liquidity', message: 'No liquidity available for this outcome' } };
  }

  const weightedOdds = perCand.reduce((s, c) => s + c.weightedOddsSum, 0) / totalSize;
  const totalSlippage = globalBestOdds > 0
    ? Math.max(0, (weightedOdds - globalBestOdds) / globalBestOdds)
    : 0;

  if (totalSlippage > slippageTolerance) {
    return {
      ok: false,
      error: {
        code: 'slippage_exceeded',
        message: `Estimated slippage ${(totalSlippage * 100).toFixed(2)}% exceeds tolerance ${(slippageTolerance * 100).toFixed(2)}%`,
        detail: { slippage: totalSlippage, tolerance: slippageTolerance },
      },
    };
  }

  const allocations: Allocation[] = [];
  for (let i = 0; i < candidates.length; i++) {
    if (perCand[i].filledSize <= 0) continue;
    const c = candidates[i];
    allocations.push({
      platform: c.platform,
      outcomeId: c.outcomeId,
      externalMarketId: c.marketExternalId,
      externalOutcomeId: c.externalOutcomeId,
      size: perCand[i].filledSize,
      expectedOdds: perCand[i].weightedOddsSum / perCand[i].filledSize,
      estimatedSlippage: totalSlippage,
    });
  }

  if (allocations.length === 0) {
    return { ok: false, error: { code: 'no_liquidity', message: 'No liquidity available for this outcome' } };
  }

  return {
    ok: true,
    plan: { allocations, totalSize, weightedOdds, totalSlippage },
  };
}
