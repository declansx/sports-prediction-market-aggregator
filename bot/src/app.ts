import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import healthRouter from './routes/health';
import marketsRouter from './routes/markets';
import tradeRouter from './routes/trade';
import orderbookRouter from './routes/orderbook';
import configRouter from './routes/config';
import tradesHistoryRouter from './routes/trades-history';
import balancesRouter from './routes/balances';
import statsRouter from './routes/stats';
import { createLogger } from './logger';

const log = createLogger('http');
const app = express();

// gzip every response that compresses well — /api/markets in particular drops
// from ~3.9 MB raw to ~700 KB on the wire (~17% of original). Cheap CPU,
// massive egress savings. Must come BEFORE the route handlers.
app.use(compression());
app.use(express.json());
app.use(healthRouter);
app.use(marketsRouter);
app.use(tradeRouter);
app.use(orderbookRouter);
app.use(configRouter);
app.use(tradesHistoryRouter);
app.use(balancesRouter);
app.use(statsRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  log.error({ err }, 'unhandled request error');
  res.status(500).json({ error: 'internal_server_error' });
});

export default app;
