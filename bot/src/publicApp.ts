import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';
import healthRouter from './routes/health';
import marketsRouter from './routes/markets';
import statsRouter from './routes/stats';
import orderbookRouter from './routes/orderbook';
import { createLogger } from './logger';

const log = createLogger('http:public');
const publicApp = express();

publicApp.use(cors());
publicApp.use(express.json());
publicApp.use(healthRouter);
publicApp.use(marketsRouter);
publicApp.use(statsRouter);
publicApp.use(orderbookRouter);

publicApp.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  log.error({ err }, 'unhandled request error');
  res.status(500).json({ error: 'internal_server_error' });
});

export default publicApp;
