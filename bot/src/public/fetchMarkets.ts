/**
 * On-demand market fetch for the read-only public dashboard.
 *
 * Fetches every synced league from both platforms in parallel (purely REST —
 * no WebSocket, no DB) and reduces them to the `/api/markets` payload via
 * `buildOverlaidMarkets`. This is what the Vercel serverless function calls on
 * a cache miss; the edge cache in front of it means upstream is hit at most
 * once per cache TTL regardless of visitor count.
 *
 * League list is duplicated from `sync/marketSync.ts` on purpose: importing
 * that module would pull Prisma (and the whole DB layer) into the serverless
 * bundle. The adapters and `leagues.ts` are DB-free, so this stays light.
 */
import { fetchSxBetMarkets } from '../adapters/sxbet';
import { fetchPolymarketMarkets } from '../adapters/polymarket';
import {
  type LeagueConfig,
  EPL,
  UCL,
  UEL,
  COPA_LIBERTADORES,
  LA_LIGA,
  SERIE_A,
  BUNDESLIGA,
  EREDIVISIE,
  LIGUE_1,
  WORLD_CUP,
  NBA,
  MLB,
  NHL,
} from '../leagues';
import { buildOverlaidMarkets, type PublicMarket } from './buildMarkets';
import type { MarketQuote } from '../types';

export const PUBLIC_LEAGUES: LeagueConfig[] = [
  EPL,
  UCL,
  UEL,
  COPA_LIBERTADORES,
  LA_LIGA,
  SERIE_A,
  BUNDESLIGA,
  EREDIVISIE,
  LIGUE_1,
  WORLD_CUP,
  NBA,
  MLB,
  NHL,
];

/**
 * Fetch + reduce all public markets. A single failing league is logged-and-
 * skipped (returns []) rather than failing the whole response, matching the
 * resilience of the bot's own sync cycle.
 */
export async function fetchPublicMarkets(now: Date = new Date()): Promise<PublicMarket[]> {
  const sxFetches = PUBLIC_LEAGUES.map((league) =>
    fetchSxBetMarkets(league).catch((): MarketQuote[] => []),
  );
  const polyFetches = PUBLIC_LEAGUES.map((league) => {
    if (!league.polymarket) return Promise.resolve([] as MarketQuote[]);
    return fetchPolymarketMarkets(league).catch((): MarketQuote[] => []);
  });

  const [sxResults, polyResults] = await Promise.all([
    Promise.all(sxFetches),
    Promise.all(polyFetches),
  ]);

  return buildOverlaidMarkets(sxResults.flat(), polyResults.flat(), now);
}
