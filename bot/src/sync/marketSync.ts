import { prisma } from '../db';
import { fetchSxBetMarkets } from '../adapters/sxbet';
import { fetchPolymarketMarkets } from '../adapters/polymarket';
import { polymarketOddsCache } from '../services/polymarketOddsCache';
import { upsertMarkets } from '../db/markets';
import { emitMarketRemoved } from '../services/marketEvents';
import { EPL, UCL, UEL, COPA_LIBERTADORES, LA_LIGA, SERIE_A, BUNDESLIGA, EREDIVISIE, LIGUE_1, WORLD_CUP, NBA, MLB, NHL, type LeagueConfig } from '../leagues';
import type { MarketQuote } from '../types';
import { createLogger } from '../logger';

const log = createLogger('sync');

export const SYNCED_LEAGUES: LeagueConfig[] = [EPL, UCL, UEL, COPA_LIBERTADORES, LA_LIGA, SERIE_A, BUNDESLIGA, EREDIVISIE, LIGUE_1, WORLD_CUP, NBA, MLB, NHL];

const DEFAULT_POLL_INTERVAL_SECONDS = 30;

async function getPollingInterval(): Promise<number> {
  try {
    const row = await prisma.botConfig.findUnique({ where: { key: 'pollingInterval' } });
    const parsed = row ? parseInt(row.value, 10) : NaN;
    return isNaN(parsed) || parsed < 5 ? DEFAULT_POLL_INTERVAL_SECONDS : parsed;
  } catch {
    return DEFAULT_POLL_INTERVAL_SECONDS;
  }
}

async function seedDefaultConfig(): Promise<void> {
  await Promise.all([
    prisma.botConfig.upsert({
      where: { key: 'pollingInterval' },
      create: { key: 'pollingInterval', value: String(DEFAULT_POLL_INTERVAL_SECONDS) },
      update: {},
    }),
    prisma.botConfig.upsert({
      where: { key: 'maxTradeSize' },
      create: { key: 'maxTradeSize', value: '100' },
      update: {},
    }),
    prisma.botConfig.upsert({
      where: { key: 'slippageTolerance' },
      create: { key: 'slippageTolerance', value: '0.05' },
      update: {},
    }),
    prisma.botConfig.upsert({
      where: { key: 'orderBookLevels' },
      create: { key: 'orderBookLevels', value: '10' },
      update: {},
    }),
  ]);
}

async function deactivateStaleMarkets(
  platform: string,
  currentExternalIds: string[],
): Promise<void> {
  // Fetch all active markets for the platform and diff in JS — a `notIn`
  // filter on hundreds of IDs blows past SQLite's parameter limit, and
  // Prisma can't auto-split negation filters.
  const current = new Set(currentExternalIds);
  const active = await prisma.market.findMany({
    where: { platform, status: 'active' },
    select: { id: true, externalId: true },
  });
  const stale = active.filter((m) => !current.has(m.externalId));
  if (stale.length === 0) return;
  const ids = stale.map((m) => m.id);
  await prisma.market.updateMany({
    where: { id: { in: ids } },
    data: { status: 'inactive' },
  });
  for (const id of ids) emitMarketRemoved(id);
  log.info({ count: ids.length, platform }, 'deactivated stale markets');
}

// Mark markets whose start time is more than 4 hours ago as inactive.
// Handles the case where a platform API still returns a resolved game as active
// (Polymarket can take hours to mark closed) but the CLOB has no real orders.
async function deactivateExpiredMarkets(): Promise<void> {
  const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const expired = await prisma.market.findMany({
    where: { status: 'active', startTime: { lt: cutoff } },
    select: { id: true },
  });
  if (expired.length === 0) return;
  const ids = expired.map((m) => m.id);
  await prisma.market.updateMany({
    where: { id: { in: ids } },
    data: { status: 'inactive' },
  });
  for (const id of ids) emitMarketRemoved(id);
  log.info({ count: ids.length }, 'expired markets past start time');
}

async function runSync(): Promise<void> {
  const started = Date.now();
  log.info({ leagues: SYNCED_LEAGUES.length }, 'cycle start');

  // Fetch all leagues from both platforms in parallel, tagging each quote with its league name.
  // Adapters already stamp league.name on each quote — just collect and flatten.
  const sxFetches = SYNCED_LEAGUES.map((league) =>
    fetchSxBetMarkets(league).catch((err): MarketQuote[] => {
      log.error({ err, platform: 'sx', league: league.name }, 'fetch failed');
      return [];
    }),
  );
  const polyFetches = SYNCED_LEAGUES.map((league) => {
    if (!league.polymarket) return Promise.resolve([] as MarketQuote[]);
    return fetchPolymarketMarkets(league).catch((err): MarketQuote[] => {
      log.error({ err, platform: 'polymarket', league: league.name }, 'fetch failed');
      return [];
    });
  });

  const [sxResults, polyResults] = await Promise.all([
    Promise.all(sxFetches),
    Promise.all(polyFetches),
  ]);

  const sxQuotes = sxResults.flat();
  const polyQuotes = polyResults.flat();

  let canonLinked = 0;
  let canonSkipped = 0;
  if (sxQuotes.length > 0) {
    const s = await upsertMarkets(sxQuotes);
    canonLinked += s.linked;
    canonSkipped += s.skipped;
    await deactivateStaleMarkets('sx', sxQuotes.map((q) => q.externalId));
  }
  if (polyQuotes.length > 0) {
    const s = await upsertMarkets(polyQuotes);
    canonLinked += s.linked;
    canonSkipped += s.skipped;
    await deactivateStaleMarkets('polymarket', polyQuotes.map((q) => q.externalId));
  }

  await deactivateExpiredMarkets();

  const elapsedMs = Date.now() - started;
  log.info(
    { elapsedMs, sx: sxQuotes.length, polymarket: polyQuotes.length, canonLinked, canonSkipped },
    'cycle done',
  );

  // Audit: any subscribed Polymarket token still missing a registered fee rate
  // means its conditionId never went through any league's fetchPolymarketMarkets.
  // Those tokens render un-adjusted on the dashboard until the next cycle picks
  // them up, so flagging them helps diagnose "some markets aren't fee-adjusted".
  const unregistered = polymarketOddsCache.unregisteredTokens();
  const zeroRate = polymarketOddsCache.zeroRateTokens();
  log.info(
    {
      unregisteredCount: unregistered.length,
      zeroRateCount: zeroRate.length,
      sampleUnregistered: unregistered.slice(0, 5),
      sampleZeroRate: zeroRate.slice(0, 5),
      rateDistribution: polymarketOddsCache.rateDistribution(),
    },
    'polymarket fee-rate audit',
  );
}

export function startMarketSync(): void {
  log.info('starting market sync');

  seedDefaultConfig().catch((err) => {
    log.error({ err }, 'failed to seed BotConfig');
  });

  // Run immediately on startup, then on each interval tick
  let running = false;

  const tick = async () => {
    if (running) return; // skip if previous sync still in progress
    running = true;
    try {
      await runSync();
    } catch (err) {
      log.error({ err }, 'unexpected error during sync');
    } finally {
      running = false;
    }
  };

  tick();

  // Re-read interval each tick so config changes take effect without restart
  const schedule = async () => {
    const intervalSeconds = await getPollingInterval();
    setTimeout(async () => {
      await tick();
      schedule();
    }, intervalSeconds * 1000);
  };

  schedule();
}
