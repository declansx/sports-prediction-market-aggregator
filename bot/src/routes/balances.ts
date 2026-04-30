import { Router, Request, Response } from 'express';
import { fetchBalances } from '../adapters/balance';

const router = Router();

router.get('/api/balances', async (_req: Request, res: Response) => {
  const balances = await fetchBalances();
  res.json(balances);
});

export default router;
