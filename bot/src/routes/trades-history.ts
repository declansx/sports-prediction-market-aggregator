import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { createLogger } from '../logger';

const log = createLogger('trades-history');
const router = Router();

router.get('/api/trades', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const skip = (page - 1) * limit;

    const [total, trades] = await Promise.all([
      prisma.trade.count(),
      prisma.trade.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          market: { select: { event: { select: { homeTeam: true, awayTeam: true } } } },
          outcome: { select: { label: true } },
        },
      }),
    ]);

    const payload = trades.map((t) => ({
      id: t.id,
      createdAt: t.createdAt,
      marketName: `${t.market.event.homeTeam} vs ${t.market.event.awayTeam}`,
      outcomeLabel: t.outcome.label,
      platform: t.platform,
      side: t.side,
      requestedSize: t.requestedSize,
      executedSize: t.executedSize,
      requestedOdds: t.requestedOdds,
      fillOdds: t.fillOdds,
      status: t.status,
      txHash: t.txHash,
      failureReason: t.failureReason,
    }));

    res.json({ total, page, limit, trades: payload });
  } catch (err) {
    log.error({ err }, 'failed to fetch trades');
    res.status(500).json({ error: 'internal_server_error' });
  }
});

export default router;
