import { Router, Request, Response } from 'express';
import { getOrderBookLevels } from '../router';

// Read-only order-book endpoint, split out of trade.ts so the public
// (read-only) Express app can mount it without also exposing trade execution.
const router = Router();

// GET /api/trade/orderbook?outcomeId=
router.get('/api/trade/orderbook', async (req: Request, res: Response) => {
  const { outcomeId } = req.query;
  if (!outcomeId) {
    res.status(400).json({ error: 'outcomeId is required' });
    return;
  }
  const response = await getOrderBookLevels(outcomeId as string);
  res.json(response);
});

export default router;
