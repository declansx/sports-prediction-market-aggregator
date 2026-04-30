import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('../config', () => ({
  config: { SX_BET_API_URL: 'https://api.sx.bet', SX_BET_API_KEY: 'test-key', LOG_LEVEL: 'silent', NODE_ENV: 'test' },
}));

vi.mock('../db', () => ({
  prisma: {
    event: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    market: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

import { prisma } from '../db';
import {
  seedFixtureStatuses,
  seedLiveScores,
  seedAllFixtureState,
  finalizeFixture,
  startFixtureFinalizer,
} from './sxFixtureService';
import { fixtureStateCache, FIXTURE_STATUS } from './fixtureStateCache';

function mockFetchJson(responses: Array<{ url?: RegExp; body: unknown; ok?: boolean; status?: number }>): void {
  let i = 0;
  global.fetch = vi.fn(async (url: string) => {
    const next = responses[Math.min(i, responses.length - 1)];
    if (next.url && !next.url.test(url)) {
      throw new Error(`unexpected url ${url}`);
    }
    i += 1;
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      json: async () => next.body,
    } as Response;
  }) as unknown as typeof fetch;
}

describe('sxFixtureService', () => {
  beforeEach(() => {
    for (const state of fixtureStateCache.getSnapshot()) {
      fixtureStateCache.delete(state.sxEventId);
    }
    fixtureStateCache.removeAllListeners();
    vi.clearAllMocks();
  });

  afterEach(() => {
    fixtureStateCache.removeAllListeners();
  });

  describe('seedFixtureStatuses', () => {
    it('is a no-op for empty ids', async () => {
      global.fetch = vi.fn();
      await seedFixtureStatuses([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('batches requests in chunks of 30', async () => {
      const ids = Array.from({ length: 75 }, (_, i) => `L${i}`);
      const body = { status: 'success', data: {} };
      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => body,
      })) as unknown as typeof fetch;
      global.fetch = fetchMock;

      await seedFixtureStatuses(ids);

      const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      expect(calls.length).toBe(3);
      const firstUrl = calls[0][0] as string;
      expect(firstUrl).toContain('/fixture/status?sportXEventIds=');
      // first batch should have exactly 30 comma-separated ids
      const firstBatch = firstUrl.split('sportXEventIds=')[1].split(',');
      expect(firstBatch.length).toBe(30);
    });

    it('populates the cache with status codes', async () => {
      mockFetchJson([
        {
          body: {
            status: 'success',
            data: {
              L1: { status: 2 },
              L2: { status: 1 },
            },
          },
        },
      ]);

      await seedFixtureStatuses(['L1', 'L2']);

      expect(fixtureStateCache.get('L1')?.status).toBe(2);
      expect(fixtureStateCache.get('L2')?.status).toBe(1);
    });
  });

  describe('seedLiveScores', () => {
    it('parses live score payload', async () => {
      mockFetchJson([
        {
          body: {
            status: 'success',
            data: [
              {
                sportId: 3,
                leagueId: 171,
                sportXeventId: 'L1',
                currentPeriod: '5th Inning',
                periodTime: '-1',
                teamOneScore: 4,
                teamTwoScore: 1,
                periods: [
                  { label: '1st Inning', isFinished: true, teamOneScore: '4', teamTwoScore: '0' },
                ],
                updatedAt: '2026-03-13T18:21:26.741Z',
              },
            ],
          },
        },
      ]);

      await seedLiveScores(['L1']);
      const state = fixtureStateCache.get('L1');
      expect(state).toBeDefined();
      expect(state!.teamOneScore).toBe(4);
      expect(state!.teamTwoScore).toBe(1);
      expect(state!.currentPeriod).toBe('5th Inning');
      expect(state!.periodTime).toBe('-1');
      expect(state!.periods).toHaveLength(1);
    });

    it('batches in chunks of 30', async () => {
      const ids = Array.from({ length: 31 }, (_, i) => `L${i}`);
      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: 'success', data: [] }),
      })) as unknown as typeof fetch;
      global.fetch = fetchMock;

      await seedLiveScores(ids);

      const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      expect(calls.length).toBe(2);
    });
  });

  describe('seedAllFixtureState', () => {
    it('pulls sxEventIds from DB and calls both seeders', async () => {
      (prisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { sxEventId: 'L1' },
        { sxEventId: 'L2' },
        { sxEventId: null }, // ignored
      ]);

      const fetchMock = vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () =>
          url.includes('/fixture/status')
            ? { status: 'success', data: { L1: { status: 2 }, L2: { status: 1 } } }
            : { status: 'success', data: [] },
      })) as unknown as typeof fetch;
      global.fetch = fetchMock;

      await seedAllFixtureState();

      const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const statusCall = calls.find((c) => (c[0] as string).includes('/fixture/status'));
      const liveCall = calls.find((c) => (c[0] as string).includes('/live-scores'));
      expect(statusCall).toBeDefined();
      expect(liveCall).toBeDefined();
    });

    it('is a no-op when no events have sxEventId', async () => {
      (prisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      global.fetch = vi.fn();
      await seedAllFixtureState();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('finalizeFixture', () => {
    it('updates Event.status and cascades Market.status via transaction', async () => {
      (prisma.event.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'evt1' });
      (prisma.event.update as ReturnType<typeof vi.fn>).mockReturnValue('UPDATE_EVENT');
      (prisma.market.updateMany as ReturnType<typeof vi.fn>).mockReturnValue('UPDATE_MARKET');

      await finalizeFixture('L1');

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'evt1' },
        data: { status: 'finished' },
      });
      expect(prisma.market.updateMany).toHaveBeenCalledWith({
        where: { eventId: 'evt1' },
        data: { status: 'finished' },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('is a no-op when Event is not found / already finished', async () => {
      (prisma.event.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      await finalizeFixture('Lunknown');
      expect(prisma.event.update).not.toHaveBeenCalled();
      expect(prisma.market.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('startFixtureFinalizer', () => {
    it('calls finalizeFixture on cache finalize event for terminal status', async () => {
      (prisma.event.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'evt1' });

      startFixtureFinalizer();

      fixtureStateCache.set({
        sxEventId: 'L1',
        status: FIXTURE_STATUS.FINISHED,
        teamOneScore: 2,
        teamTwoScore: 1,
        currentPeriod: 'FT',
        periodTime: '-1',
        periods: [],
        updatedAt: Date.now(),
      });

      // wait one tick for async handler
      await new Promise((r) => setImmediate(r));

      expect(prisma.event.findFirst).toHaveBeenCalledWith({
        where: { sxEventId: 'L1', status: 'active' },
        select: { id: true },
      });
    });
  });
});
