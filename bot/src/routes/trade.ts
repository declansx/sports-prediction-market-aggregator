import { Router, Request, Response } from 'express';
import { buildAllocationPlan } from '../router';
import { createPendingTrade, markTradeFilled, markTradeFailed } from '../db/trades';
import { executeSxBetFill } from '../executor/sxbet';
import { executePolymarketOrder } from '../executor/polymarket';
import { refreshPolymarketBook } from '../services/polymarketWs';
import { sendTradeNotification } from '../telegram/notify';
import type { Allocation } from '../types';
import { createLogger } from '../logger';

const log = createLogger('trade');
const router = Router();

// GET /api/trade/preview?outcomeId=&side=&size=
router.get('/api/trade/preview', async (req: Request, res: Response) => {
  const { outcomeId, side, size } = req.query;

  if (!outcomeId || !side || !size) {
    res.status(400).json({ error: 'outcomeId, side, and size are required' });
    return;
  }

  const sizeNum = parseFloat(size as string);
  if (isNaN(sizeNum) || sizeNum <= 0) {
    res.status(400).json({ error: 'size must be a positive number' });
    return;
  }

  const result = await buildAllocationPlan(outcomeId as string, side as string, sizeNum);

  if (!result.ok) {
    const statusCode = result.error.code === 'outcome_not_found' ? 404
      : result.error.code === 'size_exceeds_max' ? 400
      : result.error.code === 'slippage_exceeded' ? 422
      : 400;
    res.status(statusCode).json({ error: result.error.code, message: result.error.message, detail: result.error.detail });
    return;
  }

  res.json(result.plan);
});

// NOTE: GET /api/trade/orderbook lives in routes/orderbook.ts so the public
// read-only app can mount it without exposing trade execution.

// POST /api/trade
// Body: { outcomeId, side, size }
router.post('/api/trade', async (req: Request, res: Response) => {
  const { outcomeId, side, size } = req.body as {
    outcomeId?: string;
    side?: string;
    size?: number;
  };

  if (!outcomeId || !side || size == null) {
    res.status(400).json({ error: 'outcomeId, side, and size are required' });
    return;
  }

  const sizeNum = Number(size);
  if (isNaN(sizeNum) || sizeNum <= 0) {
    res.status(400).json({ error: 'size must be a positive number' });
    return;
  }

  // Build the allocation plan
  const result = await buildAllocationPlan(outcomeId, side, sizeNum);

  if (!result.ok) {
    if (result.error.code === 'outcome_not_found') {
      res.status(404).json({ error: result.error.code, message: result.error.message });
      return;
    }
    if (result.error.code === 'size_exceeds_max') {
      res.status(400).json({ error: result.error.code, message: result.error.message });
      return;
    }
    if (result.error.code === 'slippage_exceeded') {
      // Write failed Trade rows for each allocation that would have been used
      // We don't have pending rows yet since routing failed before execution
      res.status(422).json({ error: result.error.code, message: result.error.message, detail: result.error.detail });
      return;
    }
    res.status(400).json({ error: result.error.code, message: result.error.message });
    return;
  }

  const { plan } = result;
  const tradeResults: Array<{ tradeId: string; status: string; platform: string; txHash?: string }> = [];

  // Execute each allocation sequentially; track all results
  for (const allocation of plan.allocations) {
    // Look up the market for this allocation (needed for marketId on the Trade row)
    const { prisma } = await import('../db');
    const outcome = await prisma.outcome.findUnique({
      where: { id: allocation.outcomeId },
      select: { marketId: true, label: true, market: { select: { event: { select: { homeTeam: true, awayTeam: true } } } } },
    });

    if (!outcome) {
      tradeResults.push({ tradeId: 'unknown', status: 'failed', platform: allocation.platform });
      continue;
    }

    const tradeId = await createPendingTrade({
      marketId: outcome.marketId,
      outcomeId: allocation.outcomeId,
      platform: allocation.platform,
      side,
      requestedSize: allocation.size,
      requestedOdds: allocation.expectedOdds,
    });

    log.info(
      { tradeId, platform: allocation.platform, outcomeId: allocation.outcomeId, size: allocation.size, expectedOdds: allocation.expectedOdds, side },
      'trade requested',
    );

    try {
      const txHash = await executeAllocation(allocation);
      await markTradeFilled(tradeId, txHash, allocation.size, allocation.expectedOdds);
      tradeResults.push({ tradeId, status: 'filled', platform: allocation.platform, txHash });
      log.info(
        { tradeId, platform: allocation.platform, txHash, fillOdds: allocation.expectedOdds, size: allocation.size },
        'trade filled',
      );
      // After a Polymarket fill, the consumed level is sometimes not pushed
      // promptly via WS price_change — the dashboard's orderbook would keep
      // showing the stale level. Force-refresh the cache from CLOB REST so
      // dashboard subscribers receive an accurate snapshot immediately.
      if (allocation.platform === 'polymarket' && allocation.externalOutcomeId) {
        refreshPolymarketBook(allocation.externalOutcomeId).catch((err) => {
          log.warn({ err, tokenId: allocation.externalOutcomeId, tradeId }, 'post-fill book refresh failed');
        });
      }
      sendTradeNotification({
        marketName: `${outcome.market.event.homeTeam} vs ${outcome.market.event.awayTeam}`,
        outcomeLabel: outcome.label,
        platform: allocation.platform,
        side,
        size: allocation.size,
        fillOdds: allocation.expectedOdds,
        txHash,
        status: 'filled',
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown_error';
      await markTradeFailed(tradeId, reason);
      tradeResults.push({ tradeId, status: 'failed', platform: allocation.platform });
      log.error({ err, tradeId, platform: allocation.platform, reason }, 'trade failed');
      sendTradeNotification({
        marketName: `${outcome.market.event.homeTeam} vs ${outcome.market.event.awayTeam}`,
        outcomeLabel: outcome.label,
        platform: allocation.platform,
        side,
        size: allocation.size,
        status: 'failed',
        failureReason: reason,
      });
    }
  }

  const allFilled = tradeResults.every((t) => t.status === 'filled');
  const anyFilled = tradeResults.some((t) => t.status === 'filled');

  res.status(anyFilled ? 201 : 422).json({
    status: allFilled ? 'filled' : anyFilled ? 'partial' : 'failed',
    trades: tradeResults,
    plan,
  });
});

async function executeAllocation(allocation: Allocation): Promise<string> {
  if (allocation.platform === 'sx') {
    const fill = await executeSxBetFill(
      allocation.externalMarketId,
      allocation.externalOutcomeId,
      allocation.size,
      allocation.expectedOdds,
    );
    return fill.fillHash;
  }

  if (allocation.platform === 'polymarket') {
    const order = await executePolymarketOrder(
      allocation.externalOutcomeId,
      allocation.size,
      allocation.expectedOdds,
    );
    return order.orderId;
  }

  throw new Error(`Unknown platform: ${allocation.platform}`);
}

export default router;
