import { Centrifuge } from 'centrifuge';
import WebSocket from 'ws';
import { config } from '../src/config';

const TARGET_HASH = '0x1d178445a0dc5f9d9063698a6c1135868d9381fc8645882202a55d2810581554';

function ts(): string {
  return new Date().toISOString();
}

function log(label: string, payload: unknown): void {
  console.log(`[${ts()}] ${label}`, JSON.stringify(payload, null, 2));
}

async function fetchToken(): Promise<string> {
  const res = await fetch(`${config.SX_BET_API_URL}/user/realtime-token/api-key`, {
    headers: { 'x-api-key': config.SX_BET_API_KEY },
  });
  if (!res.ok) throw new Error(`token fetch failed: ${res.status}`);
  const body = (await res.json()) as { token: string };
  return body.token;
}

async function snapshotBestOddsRest(): Promise<void> {
  const url = `${config.SX_BET_API_URL}/orders/odds/best?marketHashes=${TARGET_HASH}&baseToken=0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B`;
  const res = await fetch(url, { headers: { 'x-api-key': config.SX_BET_API_KEY } });
  const body = await res.json();
  log('REST /orders/odds/best (USDC)', body);
}

async function snapshotOrdersRest(): Promise<void> {
  const url = `${config.SX_BET_API_URL}/orders?marketHashes=${TARGET_HASH}`;
  const res = await fetch(url, { headers: { 'x-api-key': config.SX_BET_API_KEY } });
  const body = await res.json();
  log('REST /orders (all baseTokens)', body);
}

async function main(): Promise<void> {
  console.log(`probing market ${TARGET_HASH}`);
  console.log('listening for best_odds:global and order_book:market_<hash> events');
  console.log('every event involving this market hash will be printed below');
  console.log('---');

  await snapshotBestOddsRest();
  await snapshotOrdersRest();

  const client = new Centrifuge(config.SX_BET_WS_URL, {
    websocket: WebSocket as unknown as typeof globalThis.WebSocket,
    getToken: fetchToken,
  });

  client.on('connected', () => log('WS connected', {}));
  client.on('disconnected', (ctx) => log('WS disconnected', ctx));
  client.on('error', (ctx) => log('WS error', ctx));

  const bestOdds = client.newSubscription('best_odds:global');
  bestOdds.on('subscribed', () => log('subscribed best_odds:global', {}));
  bestOdds.on('publication', (ctx) => {
    const batch = ctx.data as Array<{ marketHash: string; baseToken: string; isMakerBettingOutcomeOne: boolean; percentageOdds: string; updatedAt: number }>;
    if (!Array.isArray(batch)) return;
    const hits = batch.filter((p) => p.marketHash === TARGET_HASH);
    if (hits.length === 0) return;
    log('best_odds:global → MATCH', hits);
  });

  const book = client.newSubscription(`order_book:market_${TARGET_HASH}`, {
    positioned: true,
    recoverable: true,
  });
  book.on('subscribed', () => log(`subscribed order_book:market_${TARGET_HASH}`, {}));
  book.on('publication', (ctx) => {
    log('order_book → publication', ctx.data);
  });

  bestOdds.subscribe();
  book.subscribe();
  client.connect();

  // Periodic REST snapshot every 15s so you can see how REST view evolves
  const interval = setInterval(() => {
    snapshotBestOddsRest().catch((err) => log('REST snapshot error', { err: String(err) }));
  }, 15_000);

  process.on('SIGINT', () => {
    clearInterval(interval);
    client.disconnect();
    console.log('\nstopped');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
