/**
 * On-demand order-book depth for the read-only public dashboard.
 *
 * The full bot serves the book from `getOrderBookLevels`, which reads the DB +
 * live WS-fed in-memory caches. The public path has neither, so this stateless
 * variant rebuilds the depth ladder straight from each platform's REST book,
 * reusing the adapters' existing maker→taker (SX) and fee (Polymarket) math.
 *
 * Inputs are the precise per-outcome book pointers the public `/api/markets`
 * payload already exposes as `PublicOutcome.externalId`:
 *   sx   = "${marketHash}:${side 0|1}"   — one SX binary side
 *   poly = "${clobTokenId}"              — one Polymarket token
 * A canonical bet usually has one of each; both books are merged into a single
 * ascending-by-odds ladder so the panel shows cross-venue depth like the full
 * app. Either pointer may be omitted.
 */
import { fetchOrdersForHashes, buildOutcome } from '../adapters/sxbet';
import { fetchClobBook, buildOutcomeFromBook, SPORTS_FEE_RATE } from '../adapters/polymarket';

export interface PublicOrderBookLevel {
  odds: number;
  size: number;
  platform: 'sx' | 'polymarket';
}

export interface PublicOrderBookResponse {
  levels: PublicOrderBookLevel[];
  sxMarketHash?: string;
  sxSide?: 0 | 1;
  polyTokenId?: string;
}

async function sxSideLevels(
  sxPointer: string,
): Promise<{ levels: PublicOrderBookLevel[]; hash: string; side: 0 | 1 }> {
  // Pointer is "${marketHash}:${side}" — split on the LAST colon (the hash has none).
  const idx = sxPointer.lastIndexOf(':');
  const hash = idx === -1 ? sxPointer : sxPointer.slice(0, idx);
  const side: 0 | 1 = sxPointer.slice(idx + 1) === '1' ? 1 : 0;
  const orders = await fetchOrdersForHashes([hash]);
  // side 0 → taker bets outcomeOne; side 1 → taker bets outcomeTwo.
  const outcome = buildOutcome('', orders, side === 0);
  return {
    levels: outcome.liquidityDepth.topLevels.map((l) => ({ odds: l.odds, size: l.size, platform: 'sx' as const })),
    hash,
    side,
  };
}

async function polyTokenLevels(tokenId: string): Promise<PublicOrderBookLevel[]> {
  const book = await fetchClobBook(tokenId);
  const outcome = buildOutcomeFromBook('', book ?? undefined, 0, 0, SPORTS_FEE_RATE);
  return outcome.liquidityDepth.topLevels.map((l) => ({ odds: l.odds, size: l.size, platform: 'polymarket' as const }));
}

export async function fetchPublicOrderBook(
  pointers: { sx?: string | null; poly?: string | null },
): Promise<PublicOrderBookResponse> {
  const { sx, poly } = pointers;

  const [sxResult, polyResult] = await Promise.all([
    sx ? sxSideLevels(sx) : Promise.resolve(null),
    poly ? polyTokenLevels(poly) : Promise.resolve(null),
  ]);

  const levels = [...(sxResult?.levels ?? []), ...(polyResult ?? [])].sort((a, b) => a.odds - b.odds);

  const response: PublicOrderBookResponse = { levels };
  if (sxResult) {
    response.sxMarketHash = sxResult.hash;
    response.sxSide = sxResult.side;
  }
  if (poly) response.polyTokenId = poly;
  return response;
}
