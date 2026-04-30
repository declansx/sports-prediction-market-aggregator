import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./index', () => ({
  prisma: {
    trade: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from './index';
import { createPendingTrade, markTradeFilled, markTradeFailed, getTrade } from './trades';

const mockPrisma = prisma as unknown as {
  trade: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('createPendingTrade', () => {
  it('creates a trade with status=pending and returns the id', async () => {
    mockPrisma.trade.create.mockResolvedValue({ id: 'trade-abc' });

    const id = await createPendingTrade({
      marketId: 'market-1',
      outcomeId: 'outcome-1',
      platform: 'sx',
      side: 'buy',
      requestedSize: 50,
      requestedOdds: 0.55,
    });

    expect(id).toBe('trade-abc');
    expect(mockPrisma.trade.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'pending',
        platform: 'sx',
        requestedSize: 50,
      }),
    });
  });
});

describe('markTradeFilled', () => {
  it('updates trade to filled with txHash and fill details', async () => {
    mockPrisma.trade.update.mockResolvedValue({});

    await markTradeFilled('trade-abc', '0xfillhash', 50, 0.549);

    expect(mockPrisma.trade.update).toHaveBeenCalledWith({
      where: { id: 'trade-abc' },
      data: expect.objectContaining({
        status: 'filled',
        txHash: '0xfillhash',
        executedSize: 50,
        fillOdds: 0.549,
      }),
    });
  });
});

describe('markTradeFailed', () => {
  it('updates trade to failed with failure reason', async () => {
    mockPrisma.trade.update.mockResolvedValue({});

    await markTradeFailed('trade-abc', 'slippage_exceeded');

    expect(mockPrisma.trade.update).toHaveBeenCalledWith({
      where: { id: 'trade-abc' },
      data: expect.objectContaining({
        status: 'failed',
        failureReason: 'slippage_exceeded',
      }),
    });
  });
});

describe('getTrade', () => {
  it('returns the trade by id', async () => {
    const fakeTrade = { id: 'trade-abc', status: 'filled' };
    mockPrisma.trade.findUnique.mockResolvedValue(fakeTrade);

    const trade = await getTrade('trade-abc');
    expect(trade).toEqual(fakeTrade);
  });
});
