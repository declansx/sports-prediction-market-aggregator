import { prisma } from '../db';
import { subscribeToPolyBestOdds, unsubscribeFromPolyBestOdds } from './polymarketWs';
import { createLogger } from '../logger';

const log = createLogger('persistentPolyOdds');

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Token IDs this service currently holds a bestOdds ref on. */
const owned = new Set<string>();

async function queryTokenIds(): Promise<Set<string>> {
  const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const outcomes = await prisma.outcome.findMany({
    where: {
      externalId: { not: null },
      market: {
        platform: 'polymarket',
        status: 'active',
        startTime: { lte: cutoff },
      },
    },
    select: { externalId: true },
  });

  const ids = new Set<string>();
  for (const o of outcomes) {
    if (o.externalId) ids.add(o.externalId);
  }
  return ids;
}

async function refresh(): Promise<void> {
  let desired: Set<string>;
  try {
    desired = await queryTokenIds();
  } catch (err) {
    log.error({ err }, 'DB query failed — retaining existing subscriptions');
    return;
  }

  // Subscribe new tokens
  let added = 0;
  for (const id of desired) {
    if (!owned.has(id)) {
      subscribeToPolyBestOdds(id);
      owned.add(id);
      added++;
    }
  }

  // Unsubscribe tokens that left the window
  let removed = 0;
  for (const id of owned) {
    if (!desired.has(id)) {
      unsubscribeFromPolyBestOdds(id);
      owned.delete(id);
      removed++;
    }
  }

  log.info({ total: owned.size, added, removed }, 'subscribed tokens');
}

export function startPersistentPolyOddsService(): void {
  // Initial subscription — runs after polymarketWs is started
  refresh().catch((err) => log.error({ err }, 'initial refresh failed'));
  setInterval(() => {
    refresh().catch((err) => log.error({ err }, 'refresh failed'));
  }, REFRESH_INTERVAL_MS);
}
