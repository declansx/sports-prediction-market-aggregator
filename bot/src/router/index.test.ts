import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma so router tests don't need a real DB
vi.mock('../db', () => ({
  prisma: {
    botConfig: {
      findUnique: vi.fn(),
    },
    outcome: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    market: {
      findMany: vi.fn(),
    },
  },
}));

// Mock live caches so we can drive the live-vs-DB fallback path
const { mockSxGetLevels, mockPolyGetLevels, mockWarmMarketBook, mockWarmPolyBook } = vi.hoisted(() => ({
  mockSxGetLevels: vi.fn(),
  mockPolyGetLevels: vi.fn(),
  mockWarmMarketBook: vi.fn(),
  mockWarmPolyBook: vi.fn(),
}));
vi.mock('../services/orderBookCache', () => ({
  orderBookCache: { getLevels: mockSxGetLevels },
}));
vi.mock('../services/polymarketBookCache', () => ({
  polymarketBookCache: { getLevels: mockPolyGetLevels },
}));
// Stub the seed-and-wait helpers so the router doesn't try to make real REST
// calls during unit tests when the live caches are mocked empty.
vi.mock('../services/centrifugo', () => ({
  warmMarketBook: mockWarmMarketBook,
}));
vi.mock('../services/polymarketWs', () => ({
  warmPolyBook: mockWarmPolyBook,
}));

import { prisma } from '../db';
import { buildAllocationPlan, getOrderBookLevels } from './index';

const mockPrisma = prisma as unknown as {
  botConfig: { findUnique: ReturnType<typeof vi.fn> };
  outcome: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  market: { findMany: ReturnType<typeof vi.fn> };
};

const SX_MARKET = {
  id: 'market-1',
  eventId: 'event-1',
  platform: 'sx',
  externalId: '0xmarketHash',
  betType: '1x2',
  line: null,
  status: 'active',
};

const SX_OUTCOME = {
  id: 'outcome-1',
  marketId: 'market-1',
  label: 'Lakers',
  externalId: '0xmarketHash:0',
  currentOdds: 0.55,
  liquidityDepth: 500,
  liquidityLevels: JSON.stringify([
    { odds: 0.55, size: 200 },
    { odds: 0.53, size: 300 },
  ]),
  canonicalBetId: 'cb-1',
  market: SX_MARKET,
};

beforeEach(() => {
  vi.resetAllMocks();
  // Default: no BotConfig overrides → use defaults (maxTradeSize=100, slippageTolerance=0.05)
  mockPrisma.botConfig.findUnique.mockResolvedValue(null);
  mockPrisma.outcome.findMany.mockResolvedValue([]);
  mockPrisma.market.findMany.mockResolvedValue([
    { id: SX_MARKET.id, externalId: SX_MARKET.externalId },
  ]);
  // Default: live caches empty → router falls back to DB liquidityLevels
  mockSxGetLevels.mockReturnValue({ outcomeOne: [], outcomeTwo: [] });
  mockPolyGetLevels.mockReturnValue([]);
  mockWarmMarketBook.mockResolvedValue(undefined);
  mockWarmPolyBook.mockResolvedValue(undefined);
});

describe('buildAllocationPlan', () => {
  it('returns size_exceeds_max when size > maxTradeSize', async () => {
    mockPrisma.botConfig.findUnique.mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === 'maxTradeSize') return Promise.resolve({ key: 'maxTradeSize', value: '50' });
      return Promise.resolve(null);
    });
    mockPrisma.outcome.findUnique.mockResolvedValue(SX_OUTCOME);
    mockPrisma.outcome.findMany.mockResolvedValue([SX_OUTCOME]);

    const result = await buildAllocationPlan('outcome-1', 'buy', 100);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('size_exceeds_max');
    }
  });

  it('returns outcome_not_found for unknown outcomeId', async () => {
    mockPrisma.outcome.findUnique.mockResolvedValue(null);

    const result = await buildAllocationPlan('nonexistent', 'buy', 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('outcome_not_found');
    }
  });

  it('returns slippage_exceeded when slippage > tolerance', async () => {
    mockPrisma.botConfig.findUnique.mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === 'slippageTolerance') return Promise.resolve({ key: 'slippageTolerance', value: '0.01' });
      return Promise.resolve(null);
    });
    const out = {
      ...SX_OUTCOME,
      currentOdds: 0.40,
      liquidityLevels: JSON.stringify([
        { odds: 0.40, size: 5 },
        { odds: 0.55, size: 200 },
      ]),
    };
    mockPrisma.outcome.findUnique.mockResolvedValue(out);
    mockPrisma.outcome.findMany.mockResolvedValue([out]);

    const result = await buildAllocationPlan('outcome-1', 'buy', 50);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('slippage_exceeded');
    }
  });

  it('falls back to single outcome when canonicalBetId is null (legacy)', async () => {
    const legacy = { ...SX_OUTCOME, canonicalBetId: null };
    mockPrisma.outcome.findUnique.mockResolvedValue(legacy);

    const result = await buildAllocationPlan('outcome-1', 'buy', 50);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.allocations).toHaveLength(1);
      expect(result.plan.allocations[0].platform).toBe('sx');
      expect(result.plan.allocations[0].size).toBeCloseTo(50);
    }
    // No sibling lookup performed because canonicalBetId is null
    expect(mockPrisma.outcome.findMany).not.toHaveBeenCalled();
  });

  it('aggregates liquidity across cross-platform siblings of the same canonical bet', async () => {
    mockPrisma.botConfig.findUnique.mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === 'maxTradeSize') return Promise.resolve({ key: 'maxTradeSize', value: '500' });
      if (where.key === 'slippageTolerance') return Promise.resolve({ key: 'slippageTolerance', value: '0.20' });
      return Promise.resolve(null);
    });

    // Canonical bet: spread:home:-1.5 (Home covers -1.5 = Home wins by 2+).
    // Siblings: SX line=-1.5 out1 (label "Lakers -1.5") + Poly "Lakers -1.5" YES
    // + Poly "Warriors +1.5" NO (whose adapter-emitted label is "Lakers -1.5").
    const sxOut1 = {
      ...SX_OUTCOME,
      id: 'sx-out1',
      label: 'Lakers -1.5',
      currentOdds: 0.55,
      liquidityDepth: 100,
      liquidityLevels: JSON.stringify([{ odds: 0.55, size: 100 }]),
      market: { ...SX_MARKET, id: 'sx-m1', externalId: '0xsx1' },
    };
    const polyA = {
      ...SX_OUTCOME,
      id: 'poly-a',
      label: 'Lakers -1.5',
      externalId: '0xpolyToken1',
      currentOdds: 0.54,
      liquidityDepth: 60,
      liquidityLevels: JSON.stringify([{ odds: 0.54, size: 60 }]),
      market: { ...SX_MARKET, id: 'poly-m1', platform: 'polymarket', externalId: '0xpolyCond1' },
    };
    const polyB = {
      ...SX_OUTCOME,
      id: 'poly-b',
      label: 'Lakers -1.5', // Poly "Warriors +1.5" market NO outcome — adapter labels NO as "Home -1.5"
      externalId: '0xpolyToken2',
      currentOdds: 0.56,
      liquidityDepth: 50,
      liquidityLevels: JSON.stringify([{ odds: 0.56, size: 50 }]),
      market: { ...SX_MARKET, id: 'poly-m2', platform: 'polymarket', externalId: '0xpolyCond2' },
    };

    mockPrisma.outcome.findUnique.mockResolvedValue(sxOut1);
    mockPrisma.outcome.findMany.mockResolvedValue([sxOut1, polyA, polyB]);
    mockPrisma.market.findMany.mockResolvedValue([
      { id: 'sx-m1', externalId: '0xsx1' },
      { id: 'poly-m1', externalId: '0xpolyCond1' },
      { id: 'poly-m2', externalId: '0xpolyCond2' },
    ]);

    const result = await buildAllocationPlan('sx-out1', 'buy', 200);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Cheapest first: poly-a 0.54 (60), sx-out1 0.55 (100), poly-b 0.56 (40) → total 200
      const platforms = result.plan.allocations.map((a) => a.platform).sort();
      expect(result.plan.totalSize).toBeCloseTo(200);
      expect(platforms).toEqual(['polymarket', 'polymarket', 'sx']);
    }

    expect(mockPrisma.outcome.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ canonicalBetId: 'cb-1' }),
      }),
    );
  });

  it('uses single-level fallback when liquidityLevels is null', async () => {
    const out = { ...SX_OUTCOME, liquidityLevels: null, canonicalBetId: null };
    mockPrisma.outcome.findUnique.mockResolvedValue(out);

    const result = await buildAllocationPlan('outcome-1', 'buy', 50);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.allocations[0].estimatedSlippage).toBe(0);
      expect(result.plan.allocations[0].expectedOdds).toBe(SX_OUTCOME.currentOdds);
    }
  });

  it('computes weighted odds correctly for multi-level fill', async () => {
    mockPrisma.botConfig.findUnique.mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === 'maxTradeSize') return Promise.resolve({ key: 'maxTradeSize', value: '200' });
      if (where.key === 'slippageTolerance') return Promise.resolve({ key: 'slippageTolerance', value: '0.10' });
      return Promise.resolve(null);
    });

    const out = {
      ...SX_OUTCOME,
      canonicalBetId: null,
      currentOdds: 0.50,
      liquidityDepth: 200,
      liquidityLevels: JSON.stringify([
        { odds: 0.50, size: 100 },
        { odds: 0.55, size: 100 },
      ]),
    };
    mockPrisma.outcome.findUnique.mockResolvedValue(out);

    const result = await buildAllocationPlan('outcome-1', 'buy', 200);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.weightedOdds).toBeCloseTo(0.525);
    }
  });

  it('uses live SX orderBookCache levels when available, ignoring stale DB liquidityLevels', async () => {
    // DB says SX has zero liquidity. Live cache says SX has $1000 at 0.50.
    // Router should route to SX, not fall through to a non-existent secondary.
    const stale = {
      ...SX_OUTCOME,
      canonicalBetId: null,
      liquidityDepth: 0,
      currentOdds: 0,
      liquidityLevels: '[]',
    };
    mockPrisma.outcome.findUnique.mockResolvedValue(stale);
    mockSxGetLevels.mockReturnValue({
      outcomeOne: [{ odds: 0.5, size: 1000 }],
      outcomeTwo: [],
    });

    const result = await buildAllocationPlan('outcome-1', 'buy', 50);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.allocations).toHaveLength(1);
      expect(result.plan.allocations[0].platform).toBe('sx');
      expect(result.plan.allocations[0].size).toBeCloseTo(50);
      expect(result.plan.allocations[0].expectedOdds).toBeCloseTo(0.5);
    }
  });

  it('uses live polymarketBookCache levels when available, ignoring stale DB liquidityLevels', async () => {
    const stale = {
      ...SX_OUTCOME,
      canonicalBetId: null,
      market: { ...SX_OUTCOME.market, platform: 'polymarket', externalId: '0xCond' },
      externalId: '0xPolyToken',
      liquidityDepth: 0,
      currentOdds: 0,
      liquidityLevels: '[]',
    };
    mockPrisma.outcome.findUnique.mockResolvedValue(stale);
    mockPrisma.market.findMany.mockResolvedValue([{ id: SX_MARKET.id, externalId: '0xCond' }]);
    mockPolyGetLevels.mockReturnValue([{ odds: 0.45, size: 500 }]);

    const result = await buildAllocationPlan('outcome-1', 'buy', 50);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.allocations).toHaveLength(1);
      expect(result.plan.allocations[0].platform).toBe('polymarket');
      expect(result.plan.allocations[0].expectedOdds).toBeCloseTo(0.45);
    }
  });
});

describe('getOrderBookLevels', () => {
  it('returns empty levels when outcome not found', async () => {
    mockPrisma.outcome.findUnique.mockResolvedValue(null);
    const result = await getOrderBookLevels('nope');
    expect(result.levels).toEqual([]);
  });

  it('returns single-platform levels for outcome with no canonicalBet (legacy)', async () => {
    const legacy = { ...SX_OUTCOME, canonicalBetId: null };
    mockPrisma.outcome.findUnique.mockResolvedValue(legacy);

    const result = await getOrderBookLevels('outcome-1');
    expect(result.levels.length).toBeGreaterThan(0);
    expect(result.levels.every((l) => l.platform === 'sx')).toBe(true);
    expect(result.sxMarketHash).toBe('0xmarketHash');
    expect(result.sxSide).toBe(0);
    expect(mockPrisma.outcome.findMany).not.toHaveBeenCalled();
  });

  it('aggregates levels from all canonical siblings', async () => {
    const polySib = {
      ...SX_OUTCOME,
      id: 'poly-sib',
      externalId: '0xpolyToken',
      currentOdds: 0.51,
      liquidityLevels: JSON.stringify([{ odds: 0.51, size: 100 }]),
      market: { ...SX_MARKET, id: 'poly-m', platform: 'polymarket', externalId: '0xpolyCond' },
    };
    mockPrisma.outcome.findUnique.mockResolvedValue(SX_OUTCOME);
    mockPrisma.outcome.findMany.mockResolvedValue([SX_OUTCOME, polySib]);

    const result = await getOrderBookLevels('outcome-1');
    const platforms = new Set(result.levels.map((l) => l.platform));
    expect(platforms).toEqual(new Set(['sx', 'polymarket']));
    expect(result.sxMarketHash).toBe('0xmarketHash');
    expect(result.polyTokenId).toBe('0xpolyToken');
    // Sorted by odds ascending
    for (let i = 1; i < result.levels.length; i++) {
      expect(result.levels[i].odds).toBeGreaterThanOrEqual(result.levels[i - 1].odds);
    }
  });
});
