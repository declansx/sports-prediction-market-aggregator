import { Centrifuge, type Subscription } from 'centrifuge';
import WebSocket from 'ws';
import { config } from '../config';
import { prisma } from '../db';
import { createLogger } from '../logger';
import { oddsCache } from './oddsCache';
import { orderBookCache, type SxOrderRecord } from './orderBookCache';
import { fixtureStateCache, type FixturePeriod } from './fixtureStateCache';
import { seedAllFixtureState, seedFixtureStatuses } from './sxFixtureService';
import { emitMarketUpsert, emitMarketRemoved } from './marketEvents';

const log = createLogger('centrifugo');

// USDC on Polygon — only process odds for this token
const USDC_BASE_TOKEN = '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B';

const MAX_QUEUE = 1_000;
const BOOK_UNSUBSCRIBE_GRACE_MS = 10_000;

// Publications arrive as arrays; each entry has this shape per the SX Bet docs
interface OddsPublication {
  baseToken: string;
  marketHash: string;
  isMakerBettingOutcomeOne: boolean;
  percentageOdds: string;
  updatedAt: number; // ms timestamp from the server
}

// Order book publications: arrays of order records
interface OrderBookPublication {
  orderHash: string;
  marketHash: string;
  baseToken: string;
  status: 'ACTIVE' | 'INACTIVE' | 'FILLED';
  totalBetSize: string;
  fillAmount: string;
  percentageOdds: string;
  isMakerBettingOutcomeOne: boolean;
  updateTime: number;
}

export function computeTakerOdds(percentageOdds: string): number {
  // percentageOdds=0 is SX's sentinel for "no orders on this side" — surface as 0
  // so downstream renders it as "—" rather than decimal 1.00.
  const n = Number(percentageOdds);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return parseFloat((1 - n / 1e20).toFixed(8));
}

interface BestOddsRestEntry {
  marketHash: string;
  outcomeOne: { percentageOdds: string | null; updatedAt: number | null };
  outcomeTwo: { percentageOdds: string | null; updatedAt: number | null };
}

const SEED_BATCH_SIZE = 50;

async function seedBestOdds(): Promise<void> {
  log.info('re-seeding best_odds from REST');
  // Collect every distinct SX binary marketHash by parsing Outcome.externalId
  // (format "<marketHash>:0|1"). Market.externalId alone only covers the home-win
  // hash for soccer 1X2 — draw and away-win hashes live only on Outcome rows.
  const outcomes = await prisma.outcome.findMany({
    where: {
      market: { platform: 'sx', status: 'active' },
      externalId: { not: null },
    },
    select: { externalId: true },
  });
  if (outcomes.length === 0) return;

  const hashSet = new Set<string>();
  for (const o of outcomes) {
    if (!o.externalId) continue;
    const idx = o.externalId.lastIndexOf(':');
    const hash = idx === -1 ? o.externalId : o.externalId.slice(0, idx);
    if (hash) hashSet.add(hash);
  }
  const hashes = Array.from(hashSet);
  if (hashes.length === 0) return;
  for (let i = 0; i < hashes.length; i += SEED_BATCH_SIZE) {
    const batch = hashes.slice(i, i + SEED_BATCH_SIZE);
    const url = `${config.SX_BET_API_URL}/orders/odds/best?marketHashes=${batch.join(',')}&baseToken=${USDC_BASE_TOKEN}`;
    const res = await fetch(url, { headers: { 'x-api-key': config.SX_BET_API_KEY } });
    if (!res.ok) {
      log.error({ status: res.status }, 'best_odds REST seed failed');
      continue;
    }
    const body = (await res.json()) as { data: { bestOdds: BestOddsRestEntry[] } };
    for (const item of body.data?.bestOdds ?? []) {
      oddsCache.set({
        marketHash: item.marketHash,
        isMakerBettingOutcomeOne: true,
        takerOdds: item.outcomeOne.percentageOdds ? computeTakerOdds(item.outcomeOne.percentageOdds) : 0,
        updatedAt: item.outcomeOne.updatedAt ?? Date.now(),
      });
      oddsCache.set({
        marketHash: item.marketHash,
        isMakerBettingOutcomeOne: false,
        takerOdds: item.outcomeTwo.percentageOdds ? computeTakerOdds(item.outcomeTwo.percentageOdds) : 0,
        updatedAt: item.outcomeTwo.updatedAt ?? Date.now(),
      });
    }
  }
  log.info({ count: hashes.length }, 'seeded markets');
}

async function seedMarkets(): Promise<void> {
  const res = await fetch(`${config.SX_BET_API_URL}/markets/active`, {
    headers: { 'x-api-key': config.SX_BET_API_KEY },
  });
  if (!res.ok) log.error({ status: res.status }, 'markets REST seed failed');
}

// In-flight dedupe so concurrent warmMarketBook callers share the same REST call.
const bookSeedInflight = new Map<string, Promise<void>>();

// REST seed for a single market's order book
async function seedMarketBook(marketHash: string): Promise<void> {
  const url = `${config.SX_BET_API_URL}/orders?marketHashes=${marketHash}&baseToken=${USDC_BASE_TOKEN}`;
  const res = await fetch(url, { headers: { 'x-api-key': config.SX_BET_API_KEY } });
  if (!res.ok) {
    log.error({ marketHash, status: res.status }, 'order_book REST seed failed');
    return;
  }
  const body = (await res.json()) as { data: OrderBookPublication[] };
  const records: SxOrderRecord[] = [];
  for (const o of body.data ?? []) {
    if (o.baseToken && o.baseToken !== USDC_BASE_TOKEN) continue;
    records.push({
      orderHash: o.orderHash,
      marketHash: o.marketHash,
      status: 'ACTIVE',
      totalBetSize: o.totalBetSize,
      fillAmount: o.fillAmount,
      percentageOdds: o.percentageOdds,
      isMakerBettingOutcomeOne: o.isMakerBettingOutcomeOne,
      updateTime: o.updateTime ?? Date.now(),
    });
  }
  orderBookCache.replaceMarket(marketHash, records);
}

/**
 * Public seed-and-wait entry point used by the REST orderbook handler to warm
 * the cache before responding. Resolves when the cache has been populated (or
 * the seed gave up). Does NOT subscribe upstream — the dashboard's WS subscribe
 * follows the REST call and handles the live-update lifecycle.
 */
export function warmMarketBook(marketHash: string): Promise<void> {
  const sides = orderBookCache.getLevels(marketHash);
  if (sides.outcomeOne.length > 0 || sides.outcomeTwo.length > 0) return Promise.resolve();
  const existing = bookSeedInflight.get(marketHash);
  if (existing) return existing;
  const p = seedMarketBook(marketHash).finally(() => {
    bookSeedInflight.delete(marketHash);
  });
  bookSeedInflight.set(marketHash, p);
  return p;
}

// Module-level client reference so dynamic book subs can reuse the connection
let centrifugoClient: Centrifuge | null = null;

interface BookSubState {
  sub: Subscription;
  refCount: number;
  pendingTeardown: ReturnType<typeof setTimeout> | null;
}

const bookSubs = new Map<string, BookSubState>();

export function subscribeToMarketBook(marketHash: string): void {
  const existing = bookSubs.get(marketHash);
  if (existing) {
    if (existing.pendingTeardown) {
      clearTimeout(existing.pendingTeardown);
      existing.pendingTeardown = null;
    }
    existing.refCount += 1;
    return;
  }

  if (!centrifugoClient) {
    log.warn({ marketHash }, 'subscribeToMarketBook called before client ready');
    return;
  }

  const channel = `order_book:market_${marketHash}`;
  const sub = centrifugoClient.newSubscription(channel, {
    positioned: true,
    recoverable: true,
  });

  sub.on('subscribed', (ctx) => {
    log.info({ channel }, 'subscribed');
    // Only re-seed via REST when history was NOT replayed
    if (ctx.wasRecovering && ctx.recovered) return;
    seedMarketBook(marketHash).catch((err) =>
      log.error({ err, marketHash }, 'book seed failed'),
    );
  });

  sub.on('publication', (ctx) => {
    const batch = ctx.data as OrderBookPublication[];
    if (!Array.isArray(batch)) return;
    const records: SxOrderRecord[] = [];
    for (const o of batch) {
      if (o.baseToken && o.baseToken !== USDC_BASE_TOKEN) continue;
      records.push({
        orderHash: o.orderHash,
        marketHash: o.marketHash,
        status: o.status,
        totalBetSize: o.totalBetSize,
        fillAmount: o.fillAmount,
        percentageOdds: o.percentageOdds,
        isMakerBettingOutcomeOne: o.isMakerBettingOutcomeOne,
        updateTime: o.updateTime ?? Date.now(),
      });
    }
    orderBookCache.applyBatch(marketHash, records);
  });

  sub.on('unsubscribed', (ctx) => {
    log.info({ channel, code: ctx.code }, 'unsubscribed');
  });

  sub.subscribe();

  bookSubs.set(marketHash, { sub, refCount: 1, pendingTeardown: null });
}

export function unsubscribeFromMarketBook(marketHash: string): void {
  const state = bookSubs.get(marketHash);
  if (!state) return;
  state.refCount -= 1;
  if (state.refCount > 0) return;

  // Grace period before actually tearing down — handles tab-hop churn
  state.pendingTeardown = setTimeout(() => {
    if (state.refCount === 0) {
      state.sub.unsubscribe();
      state.sub.removeAllListeners();
      // unsubscribe() alone leaves the sub in Centrifuge's internal registry;
      // without removeSubscription() a future newSubscription(channel) throws
      // "Subscription to the channel ... already exists".
      centrifugoClient?.removeSubscription(state.sub);
      bookSubs.delete(marketHash);
      orderBookCache.clearMarket(marketHash);
    }
  }, BOOK_UNSUBSCRIBE_GRACE_MS);
}

export function startCentrifugoService(): void {
  // ctx.data is always an array per docs; queue holds batches
  const queue: OddsPublication[][] = [];
  let processing = false;
  let needsReseed = false;

  function applyBatch(batch: OddsPublication[]): void {
    for (const item of batch) {
      log.trace({ marketHash: item.marketHash, isMakerOne: item.isMakerBettingOutcomeOne, baseToken: item.baseToken, pct: item.percentageOdds, ts: item.updatedAt }, 'best_odds publication');
      if (item.baseToken !== USDC_BASE_TOKEN) {
        log.trace({ marketHash: item.marketHash, baseToken: item.baseToken }, 'best_odds dropped: baseToken mismatch');
        continue;
      }
      oddsCache.set({
        marketHash: item.marketHash,
        isMakerBettingOutcomeOne: item.isMakerBettingOutcomeOne,
        takerOdds: computeTakerOdds(item.percentageOdds),
        // use server timestamp — OddsCache out-of-order guard handles duplicates
        updatedAt: item.updatedAt,
      });
    }
  }

  function drainQueue(): void {
    processing = true;
    while (queue.length > 0) {
      if (needsReseed) {
        queue.length = 0;
        needsReseed = false;
        seedBestOdds().catch((err) => log.error({ err }, 'reseed error'));
        break;
      }
      applyBatch(queue.shift()!);
    }
    processing = false;
  }

  function enqueue(batch: OddsPublication[]): void {
    if (queue.length >= MAX_QUEUE) {
      queue.length = 0;
      needsReseed = true;
      log.warn('queue overflow, re-seeding from REST');
    }
    queue.push(batch);
    if (!processing) setImmediate(drainQueue);
  }

  const client = new Centrifuge(config.SX_BET_WS_URL, {
    websocket: WebSocket as unknown as typeof globalThis.WebSocket,
    getToken: async () => {
      const res = await fetch(`${config.SX_BET_API_URL}/user/realtime-token/api-key`, {
        headers: { 'x-api-key': config.SX_BET_API_KEY },
      });
      if (res.status === 401) {
        log.error('auth failed — check SX_BET_API_KEY');
        throw new Error('auth_failed');
      }
      if (!res.ok) throw new Error(`token fetch failed: ${res.status}`);
      const body = (await res.json()) as { token: string };
      return body.token;
    },
  });
  centrifugoClient = client;

  client.on('connected', () => log.info('connected'));
  client.on('disconnected', (ctx) => {
    log.warn({ code: ctx.code }, 'disconnected, reconnecting in 5s');
    setTimeout(() => client.connect(), 5_000);
  });

  // best_odds:global — no history, always re-seed on every subscribe
  const bestOddsSub = client.newSubscription('best_odds:global');

  bestOddsSub.on('subscribed', () => {
    log.info({ channel: 'best_odds:global' }, 'subscribed');
    seedBestOdds().catch((err) => log.error({ err }, 'best_odds seed failed'));
  });

  bestOddsSub.on('publication', (ctx) => {
    enqueue(ctx.data as OddsPublication[]);
  });

  bestOddsSub.on('unsubscribed', (ctx) => {
    log.warn({ channel: 'best_odds:global', code: ctx.code }, 'unsubscribed, resubscribing');
    bestOddsSub.subscribe();
  });

  // markets:global — positioned + recoverable; only re-seed when history was NOT replayed
  const marketsSub = client.newSubscription('markets:global', {
    positioned: true,
    recoverable: true,
  });

  marketsSub.on('subscribed', (ctx) => {
    log.info({ channel: 'markets:global' }, 'subscribed');
    if (ctx.wasRecovering && ctx.recovered) return;
    seedMarkets().catch((err) => log.error({ err }, 'markets seed failed'));
  });

  // SX market publication shape (per docs); only fields the bot acts on are typed.
  interface MarketPublication {
    marketHash: string;
    status?: string;
    gameTime?: number;
    line?: number;
  }

  // Inline handler: react to status / line / gameTime changes for markets we
  // already have in the DB. New-market additions are not handled here — they
  // need full canonicalization + event linking that lives in upsertMarkets.
  // The 30s marketSync picks those up at the next cycle.
  marketsSub.on('publication', (ctx) => {
    const data = ctx.data as MarketPublication | MarketPublication[];
    const batch = Array.isArray(data) ? data : [data];
    for (const p of batch) {
      if (!p || typeof p.marketHash !== 'string') continue;
      const marketHash = p.marketHash;
      // SX externalId is the marketHash itself (see adapters/sxbet.ts).
      void (async () => {
        try {
          const existing = await prisma.market.findUnique({
            where: { platform_externalId: { platform: 'sx', externalId: marketHash } },
            select: { id: true, status: true, line: true, startTime: true },
          });
          if (!existing) return; // unknown market — let marketSync pick it up

          const sxStatus = typeof p.status === 'string' ? p.status.toUpperCase() : null;
          const newStatus = sxStatus === 'ACTIVE' ? 'active' : sxStatus ? 'inactive' : null;
          const newStartTime =
            typeof p.gameTime === 'number' ? new Date(p.gameTime * 1000) : null;
          const newLine = typeof p.line === 'number' ? p.line : null;

          const update: { status?: string; startTime?: Date; line?: number } = {};
          if (newStatus && newStatus !== existing.status) update.status = newStatus;
          if (newStartTime && newStartTime.getTime() !== existing.startTime.getTime()) {
            update.startTime = newStartTime;
          }
          if (newLine !== null && newLine !== existing.line) update.line = newLine;

          if (Object.keys(update).length === 0) return;

          await prisma.market.update({ where: { id: existing.id }, data: update });

          if (update.status === 'inactive') {
            emitMarketRemoved(existing.id);
          } else {
            emitMarketUpsert(existing.id);
          }
        } catch (err) {
          log.error({ err, marketHash }, 'markets:global inline update failed');
        }
      })();
    }
  });

  marketsSub.on('unsubscribed', (ctx) => {
    log.warn({ channel: 'markets:global', code: ctx.code }, 'unsubscribed, resubscribing');
    marketsSub.subscribe();
  });

  // main_line:global — reports which marketHash is now the main line for a
  // given (sportXEventId, marketType). Toggle mainLine flags accordingly so
  // the dashboard's "main line only" filter shows the correct row without
  // waiting for the 30s marketSync.
  interface MainLinePublication {
    marketHash: string;
    marketType: number;
    sportXEventId: string;
  }

  const mainLineSub = client.newSubscription('main_line:global', {
    positioned: true,
    recoverable: true,
  });

  mainLineSub.on('subscribed', () => {
    log.info({ channel: 'main_line:global' }, 'subscribed');
  });

  mainLineSub.on('publication', (ctx) => {
    const data = ctx.data as MainLinePublication | MainLinePublication[];
    const batch = Array.isArray(data) ? data : [data];
    for (const p of batch) {
      if (!p || typeof p.marketHash !== 'string' || typeof p.sportXEventId !== 'string') continue;
      const newMainHash = p.marketHash;
      const sxEventId = p.sportXEventId;
      void (async () => {
        try {
          // Find the new main-line market (must already exist in our DB).
          const newMain = await prisma.market.findUnique({
            where: { platform_externalId: { platform: 'sx', externalId: newMainHash } },
            select: { id: true, eventId: true, betType: true, mainLine: true },
          });
          if (!newMain) return; // unknown — marketSync will reconcile later

          // Find the previously-main market for this (event, betType) pair.
          // Limit scope by Event.sxEventId so we don't accidentally cross events.
          const prev = await prisma.market.findMany({
            where: {
              platform: 'sx',
              betType: newMain.betType,
              mainLine: true,
              event: { sxEventId },
              id: { not: newMain.id },
            },
            select: { id: true },
          });

          const ops: Promise<unknown>[] = [];
          if (!newMain.mainLine) {
            ops.push(
              prisma.market.update({ where: { id: newMain.id }, data: { mainLine: true } }),
            );
          }
          for (const m of prev) {
            ops.push(prisma.market.update({ where: { id: m.id }, data: { mainLine: false } }));
          }
          if (ops.length === 0) return;
          await Promise.all(ops);

          if (!newMain.mainLine) emitMarketUpsert(newMain.id);
          for (const m of prev) emitMarketUpsert(m.id);
        } catch (err) {
          log.error({ err, marketHash: newMainHash, sxEventId }, 'main_line:global update failed');
        }
      })();
    }
  });

  mainLineSub.on('unsubscribed', (ctx) => {
    log.warn({ channel: 'main_line:global', code: ctx.code }, 'unsubscribed, resubscribing');
    mainLineSub.subscribe();
  });

  // fixtures:live_scores — positioned + recoverable; seed via REST when history not replayed
  interface LiveScorePublication {
    teamOneScore: number;
    teamTwoScore: number;
    // Docs capitalize the E; REST uses lowercase. Accept either defensively.
    sportXEventId?: string;
    sportXeventId?: string;
    currentPeriod?: string;
    periodTime?: string;
    periods?: FixturePeriod[];
  }

  const liveScoresSub = client.newSubscription('fixtures:live_scores', {
    positioned: true,
    recoverable: true,
  });

  liveScoresSub.on('subscribed', (ctx) => {
    log.info({ channel: 'fixtures:live_scores' }, 'subscribed');
    if (ctx.wasRecovering && ctx.recovered) return;
    seedAllFixtureState().catch((err) => log.error({ err }, 'fixture seed failed'));
  });

  liveScoresSub.on('publication', (ctx) => {
    const data = ctx.data as LiveScorePublication | LiveScorePublication[];
    const batch = Array.isArray(data) ? data : [data];
    const now = Date.now();
    for (const p of batch) {
      const sxEventId = p?.sportXEventId ?? p?.sportXeventId;
      if (!sxEventId) continue;
      const existing = fixtureStateCache.get(sxEventId);
      fixtureStateCache.set({
        sxEventId,
        status: existing?.status ?? 2,
        teamOneScore: p.teamOneScore ?? 0,
        teamTwoScore: p.teamTwoScore ?? 0,
        currentPeriod: p.currentPeriod ?? '',
        periodTime: p.periodTime ?? '-1',
        periods: Array.isArray(p.periods) ? p.periods : [],
        updatedAt: now,
      });
    }
  });

  liveScoresSub.on('unsubscribed', (ctx) => {
    log.warn({ channel: 'fixtures:live_scores', code: ctx.code }, 'unsubscribed, resubscribing');
    liveScoresSub.subscribe();
  });

  // fixtures:global — fixture state changes (status transitions)
  interface FixturePublication {
    eventId: string;
    status?: number;
    startDate?: string;
  }

  const fixturesGlobalSub = client.newSubscription('fixtures:global', {
    positioned: true,
    recoverable: true,
  });

  fixturesGlobalSub.on('subscribed', (ctx) => {
    log.info({ channel: 'fixtures:global' }, 'subscribed');
    if (ctx.wasRecovering && ctx.recovered) return;
    // Re-seed statuses via REST for all active events on reconnect
    prisma.event
      .findMany({ where: { status: 'active', sxEventId: { not: null } }, select: { sxEventId: true } })
      .then((rows) => {
        const ids: string[] = [];
        for (const r of rows) if (r.sxEventId) ids.push(r.sxEventId);
        return seedFixtureStatuses(ids);
      })
      .catch((err) => log.error({ err }, 'fixture status seed failed'));
  });

  fixturesGlobalSub.on('publication', (ctx) => {
    const data = ctx.data as FixturePublication | FixturePublication[];
    const batch = Array.isArray(data) ? data : [data];
    const now = Date.now();
    for (const p of batch) {
      if (!p || typeof p.eventId !== 'string' || typeof p.status !== 'number') continue;
      const existing = fixtureStateCache.get(p.eventId);
      fixtureStateCache.set({
        sxEventId: p.eventId,
        status: p.status,
        teamOneScore: existing?.teamOneScore ?? 0,
        teamTwoScore: existing?.teamTwoScore ?? 0,
        currentPeriod: existing?.currentPeriod ?? '',
        periodTime: existing?.periodTime ?? '-1',
        periods: existing?.periods ?? [],
        updatedAt: now,
      });
    }
  });

  fixturesGlobalSub.on('unsubscribed', (ctx) => {
    log.warn({ channel: 'fixtures:global', code: ctx.code }, 'unsubscribed, resubscribing');
    fixturesGlobalSub.subscribe();
  });

  bestOddsSub.subscribe();
  marketsSub.subscribe();
  mainLineSub.subscribe();
  liveScoresSub.subscribe();
  fixturesGlobalSub.subscribe();
  client.connect();
}
