/**
 * Source for the read-only public `/api/trade/orderbook` Vercel function.
 *
 * Like serverless/markets.ts, this is the esbuild entry — the build bundles it
 * (and the bot code it imports) into a self-contained CommonJS
 * `dashboard/api/trade/orderbook.js`. Thin wrapper around
 * `bot/src/public/fetchOrderBook.ts` (DB-free; reuses the SX/Poly adapters'
 * book math).
 *
 * Query params (the precise pointers from PublicOutcome.externalId):
 *   ?sx=<marketHash>:<side 0|1>   ?poly=<clobTokenId>   — either or both.
 *
 * Requires the same dummy env as markets (READ_ONLY_MODE=true etc.); this path
 * never touches the DB and platform book reads need no key. Books move fast, so
 * the edge cache is shorter than the markets list.
 */
import { fetchPublicOrderBook } from '../../bot/src/public/fetchOrderBook';

interface RequestLike {
  url?: string;
}
interface ResponseLike {
  setHeader(key: string, value: string): void;
  status(code: number): ResponseLike;
  json(body: unknown): void;
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  try {
    const url = new URL(req.url ?? '', 'http://localhost');
    const sx = url.searchParams.get('sx');
    const poly = url.searchParams.get('poly');

    if (!sx && !poly) {
      res.status(400).json({ error: 'sx or poly pointer is required' });
      return;
    }

    const book = await fetchPublicOrderBook({ sx, poly });
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=20');
    res.status(200).json(book);
  } catch (err) {
    console.error('[api/trade/orderbook] fetch failed', err);
    res.status(500).json({ error: 'internal_server_error' });
  }
}
