import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeTakerOdds, startCentrifugoService } from './centrifugo';
import { oddsCache } from './oddsCache';
import { prisma } from '../db';

// ─── computeTakerOdds unit tests ──────────────────────────────────────────────

describe('computeTakerOdds', () => {
  // percentageOdds = makerImplied × 10^20 (10^20 = 100000000000000000000, 21 digits)
  // 0.75 × 10^20 = 75000000000000000000 → takerOdds = 1 - 0.75 = 0.25
  it('converts 75000000000000000000 (0.75 × 10^20) → takerOdds 0.25', () => {
    expect(computeTakerOdds('75000000000000000000')).toBe(0.25);
  });

  it('converts 50000000000000000000 (0.5 × 10^20) → takerOdds 0.5', () => {
    expect(computeTakerOdds('50000000000000000000')).toBe(0.5);
  });

  it('converts 90000000000000000000 (0.9 × 10^20) → takerOdds 0.1', () => {
    expect(computeTakerOdds('90000000000000000000')).toBeCloseTo(0.1, 5);
  });

  // "0" is SX's sentinel for "no orders on this side"; returning 1 here would
  // render as decimal 1.00 on the dashboard instead of "—".
  it('returns 0 for percentageOdds "0" (no orders)', () => {
    expect(computeTakerOdds('0')).toBe(0);
  });

  it('returns 0 for non-numeric input', () => {
    expect(computeTakerOdds('')).toBe(0);
    expect(computeTakerOdds('not-a-number')).toBe(0);
  });
});

// ─── Service tests ────────────────────────────────────────────────────────────

const mockBestOddsSub = {
  handlers: {} as Record<string, (...args: unknown[]) => void>,
  on(event: string, handler: (...args: unknown[]) => void) { this.handlers[event] = handler; },
  subscribe: vi.fn(),
};

const mockMarketsSub = {
  handlers: {} as Record<string, (...args: unknown[]) => void>,
  on(event: string, handler: (...args: unknown[]) => void) { this.handlers[event] = handler; },
  subscribe: vi.fn(),
};

const mockMainLineSub = {
  handlers: {} as Record<string, (...args: unknown[]) => void>,
  on(event: string, handler: (...args: unknown[]) => void) { this.handlers[event] = handler; },
  subscribe: vi.fn(),
};

const mockLiveScoresSub = {
  handlers: {} as Record<string, (...args: unknown[]) => void>,
  on(event: string, handler: (...args: unknown[]) => void) { this.handlers[event] = handler; },
  subscribe: vi.fn(),
};

const mockFixturesGlobalSub = {
  handlers: {} as Record<string, (...args: unknown[]) => void>,
  on(event: string, handler: (...args: unknown[]) => void) { this.handlers[event] = handler; },
  subscribe: vi.fn(),
};

const mockClient = {
  handlers: {} as Record<string, (...args: unknown[]) => void>,
  on(event: string, handler: (...args: unknown[]) => void) { this.handlers[event] = handler; },
  connect: vi.fn(),
  newSubscription: vi.fn(),
};

vi.mock('centrifuge', () => ({
  Centrifuge: vi.fn(() => mockClient),
}));

vi.mock('ws', () => ({ default: class MockWS {} }));

vi.mock('../config', () => ({
  config: {
    SX_BET_API_URL: 'https://api.sx.bet',
    SX_BET_API_KEY: 'test-key',
    SX_BET_WS_URL: 'wss://realtime.sx.bet/connection/websocket',
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
  },
}));

vi.mock('./oddsCache', async () => {
  const { OddsCache } = await vi.importActual<typeof import('./oddsCache')>('./oddsCache');
  return { OddsCache, oddsCache: new OddsCache() };
});

vi.mock('../db', () => ({
  prisma: {
    market: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    event: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    outcome: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('./sxFixtureService', () => ({
  seedAllFixtureState: vi.fn().mockResolvedValue(undefined),
  seedFixtureStatuses: vi.fn().mockResolvedValue(undefined),
}));

describe('startCentrifugoService', () => {
  beforeEach(() => {
    mockBestOddsSub.handlers = {};
    mockMarketsSub.handlers = {};
    mockMainLineSub.handlers = {};
    mockLiveScoresSub.handlers = {};
    mockFixturesGlobalSub.handlers = {};
    mockClient.handlers = {};
    mockBestOddsSub.subscribe.mockClear();
    mockMarketsSub.subscribe.mockClear();
    mockMainLineSub.subscribe.mockClear();
    mockLiveScoresSub.subscribe.mockClear();
    mockFixturesGlobalSub.subscribe.mockClear();
    mockClient.connect.mockClear();
    mockClient.newSubscription
      .mockReset()
      .mockReturnValueOnce(mockBestOddsSub)
      .mockReturnValueOnce(mockMarketsSub)
      .mockReturnValueOnce(mockMainLineSub)
      .mockReturnValueOnce(mockLiveScoresSub)
      .mockReturnValueOnce(mockFixturesGlobalSub);
    vi.mocked(prisma.market.findMany).mockResolvedValue([{ externalId: '0xabc' } as never]);
    vi.mocked(prisma.outcome.findMany).mockResolvedValue([{ externalId: '0xabc:0' } as never]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'test-token' }),
    }) as typeof fetch;

    // Each call creates a fresh dedup closure
    startCentrifugoService();
  });

  it('filters out non-USDC baseToken entries', async () => {
    const setSpy = vi.spyOn(oddsCache, 'set');

    const pubHandler = mockBestOddsSub.handlers['publication'];
    pubHandler({
      data: [
        // USDC token — should be applied
        { baseToken: '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B', marketHash: '0xabc', isMakerBettingOutcomeOne: false, percentageOdds: '50000000000000000000', updatedAt: 1000 },
        // different token — should be ignored
        { baseToken: '0xother', marketHash: '0xdef', isMakerBettingOutcomeOne: true, percentageOdds: '50000000000000000000', updatedAt: 1000 },
      ],
    });

    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ marketHash: '0xabc' }));
  });

  it('uses server updatedAt from payload (not Date.now())', async () => {
    const setSpy = vi.spyOn(oddsCache, 'set');

    const pubHandler = mockBestOddsSub.handlers['publication'];
    pubHandler({
      data: [{
        baseToken: '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B',
        marketHash: '0xabc',
        isMakerBettingOutcomeOne: false,
        percentageOdds: '75000000000000000000',
        updatedAt: 1747500000000,
      }],
    });

    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ updatedAt: 1747500000000 }));
  });

  it('best_odds subscribed handler always calls REST seed', async () => {
    const seedFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { bestOdds: [] } }) });
    global.fetch = seedFetch as typeof fetch;

    mockBestOddsSub.handlers['subscribed']();

    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    expect(seedFetch).toHaveBeenCalledWith(
      expect.stringContaining('/orders/odds/best'),
      expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'test-key' }) }),
    );
  });

  it('markets subscribed: wasRecovering=false calls markets seed', async () => {
    const seedFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    global.fetch = seedFetch as typeof fetch;

    mockMarketsSub.handlers['subscribed']({ wasRecovering: false, recovered: false });

    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    expect(seedFetch).toHaveBeenCalledWith(
      expect.stringContaining('/markets/active'),
      expect.anything(),
    );
  });

  it('markets subscribed: wasRecovering=true, recovered=true does NOT call seed', async () => {
    const seedFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    global.fetch = seedFetch as typeof fetch;

    mockMarketsSub.handlers['subscribed']({ wasRecovering: true, recovered: true });

    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    expect(seedFetch).not.toHaveBeenCalled();
  });

  it('markets subscribed: wasRecovering=true, recovered=false calls markets seed', async () => {
    const seedFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    global.fetch = seedFetch as typeof fetch;

    mockMarketsSub.handlers['subscribed']({ wasRecovering: true, recovered: false });

    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    expect(seedFetch).toHaveBeenCalledWith(
      expect.stringContaining('/markets/active'),
      expect.anything(),
    );
  });
});
