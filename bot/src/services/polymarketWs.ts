import WebSocket from 'ws';
import { polymarketBookCache, type ClobLevel, type PriceChange } from './polymarketBookCache';
import { polymarketOddsCache } from './polymarketOddsCache';
import { prisma } from '../db';
import { emitMarketRemoved } from './marketEvents';
import { createLogger } from '../logger';

const log = createLogger('polymarketWs');

const WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
const CLOB_API = 'https://clob.polymarket.com';

const PING_INTERVAL_MS = 10_000;
const RECONNECT_BACKOFF_MS = 3_000;
const UNSUBSCRIBE_GRACE_MS = 10_000;
// Two separate queues so book seeds (interactive TradePanel ladder) are never
// blocked behind a large best-odds seed burst (list screens subscribing to many tokens at once).
const BOOK_SEED_CONCURRENCY = 6;
const ODDS_SEED_CONCURRENCY = 6;
const SEED_TIMEOUT_MS = 5_000;

interface SubState {
  depthRefCount: number;
  bestOddsRefCount: number;
  pendingTeardown: ReturnType<typeof setTimeout> | null;
}

interface BookEventPayload {
  event_type: 'book';
  asset_id: string;
  market: string;
  bids: ClobLevel[];
  asks: ClobLevel[];
  timestamp: string;
  hash?: string;
}

interface PriceChangeEventPayload {
  event_type: 'price_change';
  asset_id: string;
  market: string;
  changes: PriceChange[];
  timestamp: string;
  hash?: string;
}

interface BestBidAskEventPayload {
  event_type: 'best_bid_ask';
  asset_id: string;
  market: string;
  best_bid: string;
  best_ask: string;
  spread?: string;
  timestamp: string;
}

interface MarketResolvedEventPayload {
  event_type: 'market_resolved';
  market?: string;
  condition_id?: string;
  assets_ids?: string[];
  clob_token_ids?: string[];
}

type PolymarketEvent =
  | BookEventPayload
  | PriceChangeEventPayload
  | BestBidAskEventPayload
  | MarketResolvedEventPayload
  | { event_type: string; asset_id?: string };

const subs = new Map<string, SubState>();

let ws: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function totalRef(s: SubState): number {
  return s.depthRefCount + s.bestOddsRefCount;
}

function getActiveTokenIds(): string[] {
  return Array.from(subs.keys()).filter((id) => {
    const s = subs.get(id);
    return !!s && totalRef(s) > 0;
  });
}

function sendFrame(payload: unknown): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch (err) {
    log.error({ err }, 'send error');
  }
}

function sendSubscribe(tokenIds: string[]): void {
  if (tokenIds.length === 0) return;
  sendFrame({
    type: 'market',
    assets_ids: tokenIds,
    operation: 'subscribe',
    custom_feature_enabled: true,
  });
}

function sendUnsubscribe(tokenIds: string[]): void {
  if (tokenIds.length === 0) return;
  sendFrame({
    type: 'market',
    assets_ids: tokenIds,
    operation: 'unsubscribe',
  });
}

// Per-token single-flight dedupe (shared across both queues).
// Stores the in-flight promise so a second caller awaits the same seed
// instead of returning instantly with no data — important for the REST
// orderbook handler which warms the cache and needs to actually wait.
const seedInflight = new Map<string, Promise<void>>();

interface SeedQueue {
  limit: number;
  active: number;
  pending: Array<() => void>;
}

const bookQueue: SeedQueue = { limit: BOOK_SEED_CONCURRENCY, active: 0, pending: [] };
const oddsQueue: SeedQueue = { limit: ODDS_SEED_CONCURRENCY, active: 0, pending: [] };

function runOn(q: SeedQueue, job: () => Promise<void>): void {
  if (q.active < q.limit) {
    q.active += 1;
    job().finally(() => {
      q.active -= 1;
      const next = q.pending.shift();
      if (next) next();
    });
  } else {
    q.pending.push(() => runOn(q, job));
  }
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), SEED_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function seedBook(tokenId: string): Promise<void> {
  const key = `book:${tokenId}`;
  const existing = seedInflight.get(key);
  if (existing) return existing;
  const promise = new Promise<void>((resolve) => {
    runOn(bookQueue, async () => {
      try {
        const res = await fetchWithTimeout(`${CLOB_API}/book?token_id=${encodeURIComponent(tokenId)}`);
        if (!res || !res.ok) return; // silent — seed is best-effort, DB/WS will populate
        const body = (await res.json()) as { bids?: ClobLevel[]; asks?: ClobLevel[] };
        polymarketBookCache.replaceBook(tokenId, body.bids ?? [], body.asks ?? [], Date.now());
      } catch {
        // silent
      } finally {
        seedInflight.delete(key);
        resolve();
      }
    });
  });
  seedInflight.set(key, promise);
  return promise;
}

async function seedBestOdds(tokenId: string): Promise<void> {
  const key = `odds:${tokenId}`;
  const existing = seedInflight.get(key);
  if (existing) return existing;
  const promise = new Promise<void>((resolve) => {
    runOn(oddsQueue, async () => {
      try {
        const res = await fetchWithTimeout(`${CLOB_API}/price?token_id=${encodeURIComponent(tokenId)}&side=SELL`);
        if (!res || !res.ok) return; // silent — falls back to DB currentOdds
        const body = (await res.json()) as { price?: string | number };
        const raw = typeof body.price === 'string' ? parseFloat(body.price) : body.price;
        if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return;
        if (polymarketOddsCache.get(tokenId)) return; // WS frame beat us
        polymarketOddsCache.set(tokenId, raw, 0, Date.now());
      } catch {
        // silent
      } finally {
        seedInflight.delete(key);
        resolve();
      }
    });
  });
  seedInflight.set(key, promise);
  return promise;
}

/**
 * Public seed-and-wait entry point used by the REST orderbook handler to warm
 * the cache before responding. Resolves when the cache has been populated (or
 * the seed gave up). Does NOT subscribe upstream — the dashboard's WS subscribe
 * follows the REST call and handles the live-update lifecycle.
 */
export function warmPolyBook(tokenId: string): Promise<void> {
  if (polymarketBookCache.hasToken(tokenId)) return Promise.resolve();
  return seedBook(tokenId);
}

// Polymarket emits `book` and `price_change` independently of `best_bid_ask`,
// so a price_change that consumes or replaces the top ask updates the book
// cache while leaving polymarketOddsCache stale. The markets-list "best odds"
// chip is derived from the odds cache — without this mirror, the chip can keep
// pointing at a Poly price that no longer exists, making SX look worse than it
// is. Re-derive top-of-book after every depth update so the two caches agree.
//
// IMPORTANT: timestamp normalization. polymarketOddsCache rejects any update
// whose `updatedAt` is <= the current entry's. seedBestOdds writes with
// Date.now() (REST has no per-row Polymarket clock to copy). If the mirror
// passes the WS event's `timestamp` instead, that value comes from Polymarket's
// clock — typically earlier than the bot's wall-clock at receive time because
// of network travel, REST call latency, and clock skew. On a quiet market that
// race deterministically goes: seed sets at T_seed, the very next WS book
// snapshot arrives with t_pm < T_seed, the mirror's set is rejected, and the
// chip stays pinned to the seeded value forever (no further events arrive to
// rescue it). Fix: use Date.now() here so seedBestOdds and the mirror share
// one monotonic clock. Same reasoning applies to the BBA path below.
function mirrorTopOfBookToOddsCache(tokenId: string): void {
  const top = polymarketBookCache.getTopOfBook(tokenId);
  if (!top || top.bestAsk === undefined) return;
  polymarketOddsCache.set(tokenId, top.bestAsk, top.bestBid ?? 0, Date.now());
}

function handleMessage(raw: WebSocket.RawData): void {
  let payload: PolymarketEvent | PolymarketEvent[];
  try {
    const text = raw.toString();
    if (text === 'PONG' || text === 'pong') return;
    payload = JSON.parse(text) as PolymarketEvent | PolymarketEvent[];
  } catch {
    return;
  }

  const events = Array.isArray(payload) ? payload : [payload];
  for (const ev of events) {
    if (!ev || typeof ev.event_type !== 'string') continue;
    if (ev.event_type === 'book') {
      const b = ev as BookEventPayload;
      if (!b.asset_id) continue;
      const state = subs.get(b.asset_id);
      // Process for any subscribed token (totalRef > 0). We can NOT gate on
      // depthRefCount alone: Polymarket's `best_bid_ask` events do not reliably
      // fire on every top-of-book change (notably when a price_change zeroes
      // the best level), so for tokens with only a bestOdds consumer the BBA
      // path leaves polymarketOddsCache pinned to a vanished top ask, causing
      // markets-list chips to favour Poly when SX is actually better. Tracking
      // the book here and mirroring top-of-book into polymarketOddsCache keeps
      // the chip authoritative regardless of whether BBA events arrive.
      if (!state || totalRef(state) === 0) continue;
      const ts = parseInt(b.timestamp, 10) || Date.now();
      polymarketBookCache.replaceBook(b.asset_id, b.bids ?? [], b.asks ?? [], ts);
      mirrorTopOfBookToOddsCache(b.asset_id);
    } else if (ev.event_type === 'price_change') {
      const p = ev as PriceChangeEventPayload;
      if (!p.asset_id || !Array.isArray(p.changes)) continue;
      const state = subs.get(p.asset_id);
      if (!state || totalRef(state) === 0) continue;
      const ts = parseInt(p.timestamp, 10) || Date.now();
      polymarketBookCache.applyPriceChange(p.asset_id, p.changes, ts);
      mirrorTopOfBookToOddsCache(p.asset_id);
    } else if (ev.event_type === 'best_bid_ask') {
      const bba = ev as BestBidAskEventPayload;
      if (!bba.asset_id) continue;
      const state = subs.get(bba.asset_id);
      if (!state || state.bestOddsRefCount === 0) continue;
      const bestAsk = parseFloat(bba.best_ask);
      const bestBid = parseFloat(bba.best_bid);
      if (!Number.isFinite(bestAsk) || bestAsk <= 0) continue;
      // Use bot wall-clock for the same reason mirror does: seedBestOdds writes
      // with Date.now(), and Polymarket's emission `timestamp` is consistently
      // earlier than that on the bot side, which would let the seed shadow real
      // BBA updates on quiet markets.
      polymarketOddsCache.set(bba.asset_id, bestAsk, Number.isFinite(bestBid) ? bestBid : 0, Date.now());
    } else if (ev.event_type === 'market_resolved') {
      // Polymarket has resolved a market — mark every DB market with one of
      // its clob token ids as inactive and tell the dashboard to drop it.
      // We match via Outcome.externalId (= clob tokenId) because Market.externalId
      // can be either the event id or the condition id depending on bet type.
      const r = ev as MarketResolvedEventPayload;
      const tokenIds = (r.assets_ids ?? r.clob_token_ids ?? []).filter((s) => typeof s === 'string' && s.length > 0);
      if (tokenIds.length === 0) continue;
      void (async () => {
        try {
          const outcomes = await prisma.outcome.findMany({
            where: { externalId: { in: tokenIds }, market: { platform: 'polymarket', status: 'active' } },
            select: { marketId: true },
          });
          if (outcomes.length === 0) return;
          const marketIds = Array.from(new Set(outcomes.map((o) => o.marketId)));
          await prisma.market.updateMany({
            where: { id: { in: marketIds } },
            data: { status: 'inactive' },
          });
          for (const id of marketIds) emitMarketRemoved(id);
          log.info({ count: marketIds.length, tokenIds }, 'polymarket market_resolved → deactivated');
        } catch (err) {
          log.error({ err, tokenIds }, 'market_resolved handler failed');
        }
      })();
    }
    // Ignore tick_size_change, last_trade_price, new_market
  }
}

function openSocket(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const socket = new WebSocket(WS_URL);
  ws = socket;

  socket.on('open', () => {
    log.info('connected');
    const tokens = getActiveTokenIds();
    if (tokens.length > 0) sendSubscribe(tokens);

    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send('PING');
        } catch {
          // ignore
        }
      }
    }, PING_INTERVAL_MS);
  });

  socket.on('message', handleMessage);

  socket.on('error', (err: unknown) => {
    log.error({ err }, 'socket error');
  });

  socket.on('close', (code: number) => {
    log.warn({ code }, 'disconnected');
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    ws = null;
    if (getActiveTokenIds().length === 0) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      openSocket();
    }, RECONNECT_BACKOFF_MS);
  });
}

function getOrCreate(tokenId: string): SubState {
  let s = subs.get(tokenId);
  if (!s) {
    s = { depthRefCount: 0, bestOddsRefCount: 0, pendingTeardown: null };
    subs.set(tokenId, s);
  }
  return s;
}

function ensureUpstream(tokenId: string): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    openSocket();
    // subscribe frame sent on open
  } else {
    sendSubscribe([tokenId]);
  }
}

function scheduleTeardown(tokenId: string): void {
  const state = subs.get(tokenId);
  if (!state) return;
  if (totalRef(state) > 0) return;
  if (state.pendingTeardown) return;
  state.pendingTeardown = setTimeout(() => {
    const s = subs.get(tokenId);
    if (!s || totalRef(s) > 0) return;
    subs.delete(tokenId);
    sendUnsubscribe([tokenId]);
    polymarketBookCache.clearBook(tokenId);
    polymarketOddsCache.clear(tokenId);
  }, UNSUBSCRIBE_GRACE_MS);
}

export function subscribeToPolyBook(tokenId: string): void {
  if (!started) {
    log.warn({ tokenId }, 'subscribeToPolyBook called before service started');
    return;
  }
  const state = getOrCreate(tokenId);
  // upstream is subscribed iff we currently have any consumer OR a teardown is still pending
  // (teardown hasn't fired yet, so the upstream subscribe frame is still active).
  const upstreamActive = totalRef(state) > 0 || state.pendingTeardown !== null;
  if (state.pendingTeardown) {
    clearTimeout(state.pendingTeardown);
    state.pendingTeardown = null;
  }
  const wasDepthActive = state.depthRefCount > 0;
  state.depthRefCount += 1;
  // Force-reseed whenever depth transitions 0→1. While depthRefCount was 0,
  // handleMessage dropped every `book` and `price_change` frame (see the
  // `depthRefCount === 0` guards), so the cache may hold levels that were
  // filled or cancelled in the gap. `hasToken` doesn't imply freshness: a
  // best-odds consumer keeps the upstream sub (and therefore the cache entry)
  // alive without keeping it up to date. Clearing first also bypasses
  // replaceBook's `updatedAt` guard, which would otherwise drop the REST
  // snapshot if WS frames had advanced the timestamp before depth went idle.
  if (!wasDepthActive) {
    polymarketBookCache.clearBook(tokenId);
    seedBook(tokenId).catch((err) => {
      log.error({ err, tokenId }, 'seedBook failed');
    });
  }
  if (!upstreamActive) ensureUpstream(tokenId);
}

export function unsubscribeFromPolyBook(tokenId: string): void {
  const state = subs.get(tokenId);
  if (!state || state.depthRefCount === 0) return;
  state.depthRefCount -= 1;
  if (totalRef(state) > 0) return;
  scheduleTeardown(tokenId);
}

/**
 * Force-invalidate the cached book for a tokenId and re-seed it from CLOB REST.
 * Used after a trade fill: Polymarket's WS `price_change` for the consumed
 * level can lag (or be missed entirely), leaving the dashboard's orderbook
 * showing a price that's already gone. Calling this after each successful
 * Polymarket fill collapses that staleness window — the REST snapshot is
 * authoritative, and seedBook() emits a polyBookUpdate the dashboard's WS
 * subscribers receive immediately.
 */
export async function refreshPolymarketBook(tokenId: string): Promise<void> {
  if (!tokenId) return;
  // Drop the cached entry so dashboard subscribers don't see the stale book
  // while we wait for the REST response. seedBook() will repopulate + emit.
  polymarketBookCache.clearBook(tokenId);
  // Also drop the cached best-odds entry — the next best_bid_ask frame (or a
  // subsequent best-odds seed) will repopulate. Without this the chip can
  // show a price that no longer exists at the freshly-cleared book level.
  polymarketOddsCache.clear(tokenId);
  await seedBook(tokenId);
}

export function subscribeToPolyBestOdds(tokenId: string): void {
  if (!started) {
    log.warn({ tokenId }, 'subscribeToPolyBestOdds called before service started');
    return;
  }
  const state = getOrCreate(tokenId);
  const upstreamActive = totalRef(state) > 0 || state.pendingTeardown !== null;
  if (state.pendingTeardown) {
    clearTimeout(state.pendingTeardown);
    state.pendingTeardown = null;
  }
  const wasBestOddsActive = state.bestOddsRefCount > 0;
  state.bestOddsRefCount += 1;
  if (!wasBestOddsActive && !polymarketOddsCache.has(tokenId)) {
    seedBestOdds(tokenId).catch((err) => {
      log.error({ err, tokenId }, 'seedBestOdds failed');
    });
  }
  if (!upstreamActive) ensureUpstream(tokenId);
}

export function unsubscribeFromPolyBestOdds(tokenId: string): void {
  const state = subs.get(tokenId);
  if (!state || state.bestOddsRefCount === 0) return;
  state.bestOddsRefCount -= 1;
  if (totalRef(state) > 0) return;
  scheduleTeardown(tokenId);
}

export function startPolymarketWsService(): void {
  if (started) return;
  started = true;
  // Seed the book cache's level count from config once at startup. The cache
  // no longer reads the DB itself (so the read-only public build can reuse the
  // Polymarket adapter without Prisma); live changes still flow via the config
  // route's setTopLevels call.
  void (async () => {
    try {
      const row = await prisma.botConfig.findUnique({ where: { key: 'orderBookLevels' } });
      const parsed = row ? parseInt(row.value, 10) : NaN;
      if (!isNaN(parsed)) polymarketBookCache.setTopLevels(parsed);
    } catch (err) {
      log.warn({ err }, 'failed to seed orderBookLevels — using default');
    }
  })();
  log.info('service started (lazy socket, opens on first subscribe)');
}
