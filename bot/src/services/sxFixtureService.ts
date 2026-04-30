import { config } from '../config';
import { prisma } from '../db';
import { createLogger } from '../logger';
import {
  fixtureStateCache,
  type FixtureState,
  type FixturePeriod,
  isTerminalStatus,
} from './fixtureStateCache';

const log = createLogger('sxFixture');

const BATCH_SIZE = 30;
const RATE_LIMIT_DELAY_MS = 10_000;

// Per the SX Bet /live-scores response shape
interface LiveScoreRestEntry {
  sportId: number;
  leagueId: number;
  sportXeventId: string;
  currentPeriod?: string;
  periodTime?: string;
  teamOneScore: number;
  teamTwoScore: number;
  periods?: FixturePeriod[];
  extra?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface FixtureStatusRestResponse {
  status: string;
  data: Record<string, { status: number }>;
}

interface LiveScoresRestResponse {
  status: string;
  data: LiveScoreRestEntry[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSx<T>(path: string): Promise<T | null> {
  const url = `${config.SX_BET_API_URL}${path}`;
  let res = await fetch(url, { headers: { 'x-api-key': config.SX_BET_API_KEY } });
  if (res.status === 429) {
    log.warn({ path }, 'rate limited, retrying in 10s');
    await sleep(RATE_LIMIT_DELAY_MS);
    res = await fetch(url, { headers: { 'x-api-key': config.SX_BET_API_KEY } });
  }
  if (!res.ok) {
    log.error({ path, status: res.status }, 'request failed');
    return null;
  }
  return (await res.json()) as T;
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function activeSxEventIds(): Promise<string[]> {
  const rows = await prisma.event.findMany({
    where: { status: 'active', sxEventId: { not: null } },
    select: { sxEventId: true },
  });
  const set = new Set<string>();
  for (const r of rows) if (r.sxEventId) set.add(r.sxEventId);
  return Array.from(set);
}

export async function seedFixtureStatuses(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  const now = Date.now();
  for (const batch of chunk(eventIds, BATCH_SIZE)) {
    const body = await fetchSx<FixtureStatusRestResponse>(
      `/fixture/status?sportXEventIds=${batch.join(',')}`,
    );
    if (!body?.data) continue;
    for (const [sxEventId, entry] of Object.entries(body.data)) {
      const existing = fixtureStateCache.get(sxEventId);
      fixtureStateCache.set({
        sxEventId,
        status: entry.status,
        teamOneScore: existing?.teamOneScore ?? 0,
        teamTwoScore: existing?.teamTwoScore ?? 0,
        currentPeriod: existing?.currentPeriod ?? '',
        periodTime: existing?.periodTime ?? '-1',
        periods: existing?.periods ?? [],
        updatedAt: now,
      });
    }
  }
}

export async function seedLiveScores(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  for (const batch of chunk(eventIds, BATCH_SIZE)) {
    const body = await fetchSx<LiveScoresRestResponse>(
      `/live-scores?sportXEventIds=${batch.join(',')}`,
    );
    if (!body?.data) continue;
    for (const entry of body.data) {
      const sxEventId = entry.sportXeventId;
      if (!sxEventId) continue;
      const existing = fixtureStateCache.get(sxEventId);
      // Use local wall-clock time, not the REST entry's updatedAt. The server timestamp
      // can be minutes old, which would lose a race against a concurrent status seed or WS
      // publication — even though the score payload itself is the freshest source of truth.
      fixtureStateCache.set({
        sxEventId,
        // Live-scores REST doesn't return status; keep whatever we have, default to IN_PROGRESS
        // since a live-score row exists only for in-play games.
        status: existing?.status ?? 2,
        teamOneScore: entry.teamOneScore ?? 0,
        teamTwoScore: entry.teamTwoScore ?? 0,
        currentPeriod: entry.currentPeriod ?? '',
        periodTime: entry.periodTime ?? '-1',
        periods: Array.isArray(entry.periods) ? entry.periods : [],
        updatedAt: Date.now(),
      });
    }
  }
}

export async function seedAllFixtureState(): Promise<void> {
  const ids = await activeSxEventIds();
  if (ids.length === 0) return;
  try {
    await seedFixtureStatuses(ids);
  } catch (err) {
    log.error({ err }, 'status seed failed');
  }
  try {
    await seedLiveScores(ids);
  } catch (err) {
    log.error({ err }, 'live-scores seed failed');
  }
  log.info({ count: ids.length }, 'seeded fixture states');
}

export async function finalizeFixture(sxEventId: string): Promise<void> {
  try {
    const event = await prisma.event.findFirst({
      where: { sxEventId, status: 'active' },
      select: { id: true },
    });
    if (!event) return;
    await prisma.$transaction([
      prisma.event.update({ where: { id: event.id }, data: { status: 'finished' } }),
      prisma.market.updateMany({ where: { eventId: event.id }, data: { status: 'finished' } }),
    ]);
    log.info({ eventId: event.id, sxEventId }, 'finalized event');
  } catch (err) {
    log.error({ err, sxEventId }, 'finalize failed');
  }
}

export function startFixtureFinalizer(): void {
  fixtureStateCache.on('finalize', (state: FixtureState) => {
    if (!isTerminalStatus(state.status)) return;
    finalizeFixture(state.sxEventId).catch((err) =>
      log.error({ err, sxEventId: state.sxEventId }, 'finalize handler threw'),
    );
  });
}
