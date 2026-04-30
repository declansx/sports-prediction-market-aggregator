import { ClobClient, Side, OrderType, Chain, SignatureTypeV2 } from '@polymarket/clob-client-v2';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';
import { config } from '../config';

let _client: ClobClient | null = null;

async function getClient(): Promise<ClobClient> {
  if (_client) return _client;

  const { POLYMARKET_PRIVATE_KEY, POLYMARKET_API_KEY, POLYMARKET_SECRET, POLYMARKET_PASSPHRASE, POLYMARKET_FUNDER_ADDRESS } = config;
  if (!POLYMARKET_PRIVATE_KEY || !POLYMARKET_API_KEY || !POLYMARKET_SECRET || !POLYMARKET_PASSPHRASE || !POLYMARKET_FUNDER_ADDRESS) {
    throw new Error('Polymarket trading credentials are not configured (READ_ONLY_MODE is active)');
  }

  const pkHex = (POLYMARKET_PRIVATE_KEY.startsWith('0x')
    ? POLYMARKET_PRIVATE_KEY
    : `0x${POLYMARKET_PRIVATE_KEY}`) as `0x${string}`;

  const signer = createWalletClient({
    account: privateKeyToAccount(pkHex),
    chain: polygon,
    transport: http(),
  });

  _client = new ClobClient({
    host: config.POLYMARKET_API_URL,
    chain: Chain.POLYGON,
    signer,
    creds: {
      key: POLYMARKET_API_KEY,
      secret: POLYMARKET_SECRET,
      passphrase: POLYMARKET_PASSPHRASE,
    },
    signatureType: SignatureTypeV2.POLY_GNOSIS_SAFE,
    funderAddress: POLYMARKET_FUNDER_ADDRESS,
  });

  return _client;
}

export interface PolyFillResult {
  orderId: string;
  filledSize: number;
  fillOdds: number;
}

/**
 * Execute a FOK BUY order on Polymarket CLOB.
 *
 * Fills entirely at the user's last-seen price or throws immediately if the
 * market has moved. No order is left resting on the book either way.
 *
 * @param tokenId - ERC-1155 outcome token ID (from Outcome.externalId)
 * @param size    - pUSD amount to spend
 * @param price   - Worst acceptable price (0–1); FOK cancels if unavailable
 */
export async function executePolymarketOrder(
  tokenId: string,
  size: number,
  price: number,
): Promise<PolyFillResult> {
  const client = await getClient();

  // tickSize and negRisk are per-market requirements for order signing.
  // negRisk is true for multi-outcome markets (e.g. soccer home/draw/away).
  const [tickSize, negRisk] = await Promise.all([
    client.getTickSize(tokenId),
    client.getNegRisk(tokenId),
  ]);

  const order = await client.createMarketOrder(
    {
      tokenID: tokenId,
      side: Side.BUY,
      amount: size, // pUSD to spend
      price,        // worst-case price — FOK cancels if market moved past this
    },
    { tickSize, negRisk },
  );

  const result = await client.postOrder(order, OrderType.FOK);

  if (!result.success) {
    throw new Error(`Polymarket order rejected: ${result.errorMsg ?? JSON.stringify(result)}`);
  }

  return {
    orderId: result.orderID ?? `order_${Date.now()}`,
    filledSize: size,
    fillOdds: price,
  };
}
