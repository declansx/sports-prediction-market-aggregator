import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

router.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      db: 'unreachable',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
