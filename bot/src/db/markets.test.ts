import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MarketQuote } from '../types';

const mockEventFindFirst = vi.fn();
const mockEventUpdate = vi.fn();
const mockEventCreate = vi.fn();
const mockMarketUpsert = vi.fn();
const mockOutcomeFindMany = vi.fn();
const mockOutcomeUpdate = vi.fn();
const mockOutcomeCreate = vi.fn();
const mockOutcomeDeleteMany = vi.fn();
const mockTeamAliasUpsert = vi.fn();
const mockCanonicalBetFindUnique = vi.fn();
const mockCanonicalBetCreate = vi.fn();
const mockCanonicalBetDeleteMany = vi.fn();

vi.mock('./index', () => ({
  prisma: {
    event: { findFirst: mockEventFindFirst, update: mockEventUpdate, create: mockEventCreate },
    market: { upsert: mockMarketUpsert },
    outcome: {
      findMany: mockOutcomeFindMany,
      update: mockOutcomeUpdate,
      create: mockOutcomeCreate,
      deleteMany: mockOutcomeDeleteMany,
    },
    canonicalBet: {
      findUnique: mockCanonicalBetFindUnique,
      create: mockCanonicalBetCreate,
      deleteMany: mockCanonicalBetDeleteMany,
    },
    teamAlias: { upsert: mockTeamAliasUpsert },
  },
}));

// teamAlias.ts calls canonicalTeamName — stub it out
vi.mock('../adapters/teamNames', () => ({
  canonicalTeamName: (name: string) => name,
}));

const SAMPLE_QUOTE: MarketQuote = {
  platform: 'sx',
  externalId: '0xabc',
  sport: 'Basketball',
  league: 'NBA',
  homeTeam: 'Lakers',
  awayTeam: 'Warriors',
  name: 'Lakers vs Warriors',
  startTime: new Date('2026-04-15'),
  betType: '1x2',
  sxEventId: 'L12345',
  outcomes: [
    {
      label: 'Lakers',
      impliedOdds: 0.52,
      liquidityDepth: { availableSize: 5000, topLevels: [{ odds: 0.52, size: 5000 }] },
    },
    {
      label: 'Warriors',
      impliedOdds: 0.48,
      liquidityDepth: { availableSize: 4800, topLevels: [{ odds: 0.48, size: 4800 }] },
    },
  ],
};

describe('upsertMarkets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTeamAliasUpsert.mockResolvedValue({});
    mockOutcomeDeleteMany.mockResolvedValue({ count: 0 });
    // Default: no existing event — findOrCreateEvent will create a new one
    mockEventFindFirst.mockResolvedValue(null);
    mockEventCreate.mockResolvedValue({
      id: 'event-1',
      homeTeam: 'Lakers',
      awayTeam: 'Warriors',
      sxEventId: null,
      polyEventId: null,
    });
    mockEventUpdate.mockResolvedValue({});
    mockOutcomeUpdate.mockResolvedValue({});
    // canonical-bet linking: default to "no existing bet" — create succeeds
    mockCanonicalBetFindUnique.mockResolvedValue(null);
    mockCanonicalBetCreate.mockImplementation((args: { data: { key: string } }) =>
      Promise.resolve({ id: `cb-${args.data.key}`, ...args.data }),
    );
    mockCanonicalBetDeleteMany.mockResolvedValue({ count: 0 });
  });

  it('creates event then market then new outcomes when none exist', async () => {
    mockMarketUpsert.mockResolvedValue({ id: 'market-1' });
    mockOutcomeFindMany.mockResolvedValue([]);
    mockOutcomeCreate.mockImplementation((args: { data: { label: string } }) =>
      Promise.resolve({ id: `out-${args.data.label}`, ...args.data }),
    );

    const { upsertMarkets } = await import('./markets');
    const summary = await upsertMarkets([SAMPLE_QUOTE]);

    expect(summary).toEqual({ linked: 2, skipped: 0 });

    // Event created (canonicalTeamName is mocked as identity in test context)
    expect(mockEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          homeTeam: 'Lakers',
          awayTeam: 'Warriors',
          sxEventId: 'L12345',
        }),
      }),
    );

    expect(mockMarketUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { platform_externalId: { platform: 'sx', externalId: '0xabc' } },
        create: expect.objectContaining({ eventId: 'event-1', betType: '1x2' }),
      }),
    );

    expect(mockOutcomeCreate).toHaveBeenCalledTimes(2);
    expect(mockOutcomeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ label: 'Lakers', currentOdds: 0.52 }) }),
    );

    // Canonical bets created for both outcomes
    expect(mockCanonicalBetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: 'event-1', key: '1x2:home', side: 'home' }),
      }),
    );
    expect(mockCanonicalBetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: 'event-1', key: '1x2:away', side: 'away' }),
      }),
    );
    // And outcomes linked
    expect(mockOutcomeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ canonicalBetId: 'cb-1x2:home' }) }),
    );
  });

  it('finds existing event by sxEventId and renames if canonical drift detected', async () => {
    // First call (by platform IDs) returns the existing event with stale team names
    mockEventFindFirst.mockResolvedValueOnce({
      id: 'event-existing',
      homeTeam: 'Old Lakers',
      awayTeam: 'Old Warriors',
      sxEventId: 'L12345',
      polyEventId: null,
    });
    mockMarketUpsert.mockResolvedValue({ id: 'market-1' });
    mockOutcomeFindMany.mockResolvedValue([]);
    mockOutcomeCreate.mockImplementation((args: { data: { label: string } }) =>
      Promise.resolve({ id: `out-${args.data.label}`, ...args.data }),
    );

    const { upsertMarkets } = await import('./markets');
    await upsertMarkets([SAMPLE_QUOTE]);

    expect(mockEventCreate).not.toHaveBeenCalled();
    // The event update should rewrite the team names to the canonical ones
    expect(mockEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event-existing' },
        data: expect.objectContaining({ homeTeam: 'Lakers', awayTeam: 'Warriors' }),
      }),
    );
    // And the canonical-bet cache for that event must be dropped so the next
    // link cycle rebuilds keys against the new home/away assignment.
    expect(mockCanonicalBetDeleteMany).toHaveBeenCalledWith({
      where: { eventId: 'event-existing' },
    });
  });

  it('falls back to league + time-window match when no platform IDs match', async () => {
    // Quote has sxEventId; first findFirst (by platform IDs) returns null,
    // second findFirst (by league + window) finds an existing event.
    const existingEvent = {
      id: 'event-existing',
      homeTeam: 'Lakers',
      awayTeam: 'Warriors',
      sxEventId: null,
      polyEventId: null,
    };
    mockEventFindFirst
      .mockResolvedValueOnce(null) // platform-id lookup
      .mockResolvedValueOnce(existingEvent); // league/time fallback
    mockMarketUpsert.mockResolvedValue({ id: 'market-1' });
    mockOutcomeFindMany.mockResolvedValue([]);
    mockOutcomeCreate.mockImplementation((args: { data: { label: string } }) =>
      Promise.resolve({ id: `out-${args.data.label}`, ...args.data }),
    );

    const { upsertMarkets } = await import('./markets');
    await upsertMarkets([SAMPLE_QUOTE]);

    expect(mockEventCreate).not.toHaveBeenCalled();
    expect(mockMarketUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ eventId: 'event-existing' }),
      }),
    );
  });

  it('updates existing outcomes instead of creating duplicates and skips re-linking when already linked', async () => {
    mockMarketUpsert.mockResolvedValue({ id: 'market-1' });
    mockOutcomeFindMany.mockResolvedValue([
      { id: 'out-1', label: 'Lakers', canonicalBetId: 'cb-existing-home' },
      { id: 'out-2', label: 'Warriors', canonicalBetId: 'cb-existing-away' },
    ]);

    const { upsertMarkets } = await import('./markets');
    const summary = await upsertMarkets([SAMPLE_QUOTE]);

    expect(mockOutcomeCreate).not.toHaveBeenCalled();
    // Two outcome updates for the data refresh, but no canonical-link writes
    // because both outcomes are already linked.
    expect(mockOutcomeUpdate).toHaveBeenCalledTimes(2);
    expect(mockOutcomeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'out-1' },
        data: expect.objectContaining({ currentOdds: 0.52, liquidityDepth: 5000 }),
      }),
    );
    expect(mockCanonicalBetCreate).not.toHaveBeenCalled();
    expect(summary).toEqual({ linked: 0, skipped: 0 });
  });

  it('reuses existing CanonicalBet when find-or-create finds one (idempotent)', async () => {
    mockMarketUpsert.mockResolvedValue({ id: 'market-1' });
    mockOutcomeFindMany.mockResolvedValue([]);
    mockOutcomeCreate.mockImplementation((args: { data: { label: string } }) =>
      Promise.resolve({ id: `out-${args.data.label}`, ...args.data }),
    );
    mockCanonicalBetFindUnique.mockImplementation(
      (args: { where: { eventId_key: { key: string } } }) =>
        Promise.resolve({ id: `existing-${args.where.eventId_key.key}`, key: args.where.eventId_key.key }),
    );

    const { upsertMarkets } = await import('./markets');
    const summary = await upsertMarkets([SAMPLE_QUOTE]);

    expect(mockCanonicalBetCreate).not.toHaveBeenCalled();
    expect(mockOutcomeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ canonicalBetId: 'existing-1x2:home' }) }),
    );
    expect(summary.linked).toBe(2);
  });

  it('continues without throwing when a DB call fails', async () => {
    mockEventFindFirst.mockReset();
    mockEventFindFirst.mockRejectedValue(new Error('DB error'));

    const { upsertMarkets } = await import('./markets');
    const summary = await upsertMarkets([SAMPLE_QUOTE]);
    expect(summary).toEqual({ linked: 0, skipped: 0 });
    // Asserting "no throw" is the meaningful behavior — the error itself is
    // reported via the logger (verified by manual debug-level inspection).
    expect(mockMarketUpsert).not.toHaveBeenCalled();
  });
});
