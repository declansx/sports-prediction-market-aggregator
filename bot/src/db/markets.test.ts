import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MarketQuote } from '../types';

const mockEventFindFirst = vi.fn();
const mockEventFindMany = vi.fn();
const mockEventUpdate = vi.fn();
const mockEventCreate = vi.fn();
const mockEventDelete = vi.fn();
const mockMarketUpsert = vi.fn();
const mockMarketFindUnique = vi.fn();
const mockMarketFindMany = vi.fn();
const mockMarketUpdateMany = vi.fn();
const mockOutcomeFindMany = vi.fn();
const mockOutcomeUpdate = vi.fn();
const mockOutcomeUpdateMany = vi.fn();
const mockOutcomeCreate = vi.fn();
const mockOutcomeDeleteMany = vi.fn();
const mockTeamAliasUpsert = vi.fn();
const mockCanonicalBetFindUnique = vi.fn();
const mockCanonicalBetCreate = vi.fn();
const mockCanonicalBetDeleteMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock('./index', () => ({
  prisma: {
    event: {
      findFirst: mockEventFindFirst,
      findMany: mockEventFindMany,
      update: mockEventUpdate,
      create: mockEventCreate,
      delete: mockEventDelete,
    },
    market: {
      upsert: mockMarketUpsert,
      findUnique: mockMarketFindUnique,
      findMany: mockMarketFindMany,
      updateMany: mockMarketUpdateMany,
    },
    outcome: {
      findMany: mockOutcomeFindMany,
      update: mockOutcomeUpdate,
      updateMany: mockOutcomeUpdateMany,
      create: mockOutcomeCreate,
      deleteMany: mockOutcomeDeleteMany,
    },
    canonicalBet: {
      findUnique: mockCanonicalBetFindUnique,
      create: mockCanonicalBetCreate,
      deleteMany: mockCanonicalBetDeleteMany,
    },
    teamAlias: { upsert: mockTeamAliasUpsert },
    $transaction: mockTransaction,
  },
}));

// teamAlias.ts calls canonicalTeamName — stub it out
vi.mock('../adapters/teamNames', () => ({
  canonicalTeamName: (name: string) => name,
}));

const mockEmitMarketUpsert = vi.fn();
vi.mock('../services/marketEvents', () => ({
  emitMarketUpsert: (id: string) => mockEmitMarketUpsert(id),
  emitMarketRemoved: vi.fn(),
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
    // Default: absorber finds no twins
    mockEventFindMany.mockResolvedValue([]);
    // $transaction(callback) runs the callback with a tx that delegates to the mocks
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        event: { update: mockEventUpdate, delete: mockEventDelete },
        market: { findMany: mockMarketFindMany, updateMany: mockMarketUpdateMany },
        outcome: { updateMany: mockOutcomeUpdateMany },
      };
      return cb(tx);
    });
    mockMarketFindMany.mockResolvedValue([]);
    mockMarketUpdateMany.mockResolvedValue({ count: 0 });
    mockOutcomeUpdateMany.mockResolvedValue({ count: 0 });
    mockEventDelete.mockResolvedValue({});
    // Default: market is brand-new (no pre-existing row) so the upsert is a
    // create and emitMarketUpsert fires. Tests that exercise the no-op path
    // override this to return a row identical to the incoming quote.
    mockMarketFindUnique.mockResolvedValue(null);
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

  // ─── emitMarketUpsert gating ──────────────────────────────────────────────
  describe('emitMarketUpsert gating', () => {
    it('emits when the market is brand-new', async () => {
      mockEmitMarketUpsert.mockClear();
      mockMarketFindUnique.mockResolvedValue(null); // new market
      mockMarketUpsert.mockResolvedValue({ id: 'market-new' });
      mockOutcomeFindMany.mockResolvedValue([]);
      mockOutcomeCreate.mockImplementation((args: { data: { label: string } }) =>
        Promise.resolve({ id: `out-${args.data.label}`, ...args.data }),
      );

      const { upsertMarkets } = await import('./markets');
      await upsertMarkets([SAMPLE_QUOTE]);

      expect(mockEmitMarketUpsert).toHaveBeenCalledWith('market-new');
    });

    it('does NOT emit when the upsert is a no-op refresh (no field changes)', async () => {
      mockEmitMarketUpsert.mockClear();
      // Pre-existing market with the SAME values the quote will write —
      // every field matches, so nothing dashboard-visible has changed.
      mockMarketFindUnique.mockResolvedValue({
        id: 'market-existing',
        eventId: 'event-1',
        status: 'active',
        betType: SAMPLE_QUOTE.betType,
        line: SAMPLE_QUOTE.line ?? null,
        mainLine: true,
        startTime: SAMPLE_QUOTE.startTime,
      });
      mockMarketUpsert.mockResolvedValue({ id: 'market-existing' });
      // Outcomes already exist with matching labels and externalIds (no
      // change there either). The handler should not fire emit.
      mockOutcomeFindMany.mockResolvedValue(
        SAMPLE_QUOTE.outcomes.map((o) => ({
          id: `out-${o.label}`,
          label: o.label,
          externalId: o.externalId ?? null,
          canonicalBetId: 'cb-existing',
        })),
      );

      const { upsertMarkets } = await import('./markets');
      await upsertMarkets([SAMPLE_QUOTE]);

      expect(mockEmitMarketUpsert).not.toHaveBeenCalled();
    });

    it('emits when an existing market changes betType', async () => {
      mockEmitMarketUpsert.mockClear();
      mockMarketFindUnique.mockResolvedValue({
        id: 'market-existing',
        eventId: 'event-1',
        status: 'active',
        betType: 'spread', // different from incoming '1x2'
        line: null,
        mainLine: true,
        startTime: SAMPLE_QUOTE.startTime,
      });
      mockMarketUpsert.mockResolvedValue({ id: 'market-existing' });
      mockOutcomeFindMany.mockResolvedValue(
        SAMPLE_QUOTE.outcomes.map((o) => ({
          id: `out-${o.label}`,
          label: o.label,
          externalId: null,
          canonicalBetId: 'cb-existing',
        })),
      );

      const { upsertMarkets } = await import('./markets');
      await upsertMarkets([SAMPLE_QUOTE]);

      expect(mockEmitMarketUpsert).toHaveBeenCalledWith('market-existing');
    });

    it('emits when a new outcome is added to an existing market', async () => {
      mockEmitMarketUpsert.mockClear();
      mockMarketFindUnique.mockResolvedValue({
        id: 'market-existing',
        eventId: 'event-1',
        status: 'active',
        betType: SAMPLE_QUOTE.betType,
        line: SAMPLE_QUOTE.line ?? null,
        mainLine: true,
        startTime: SAMPLE_QUOTE.startTime,
      });
      mockMarketUpsert.mockResolvedValue({ id: 'market-existing' });
      // Only the first outcome currently exists — the second is new.
      mockOutcomeFindMany.mockResolvedValue([
        {
          id: 'out-Lakers',
          label: 'Lakers',
          externalId: null,
          canonicalBetId: 'cb-existing',
        },
      ]);
      mockOutcomeCreate.mockImplementation((args: { data: { label: string } }) =>
        Promise.resolve({ id: `out-${args.data.label}`, ...args.data }),
      );

      const { upsertMarkets } = await import('./markets');
      await upsertMarkets([SAMPLE_QUOTE]);

      expect(mockEmitMarketUpsert).toHaveBeenCalledWith('market-existing');
    });
  });

  // ─── absorbCrossPlatformTwin ──────────────────────────────────────────────
  describe('cross-platform twin absorber', () => {
    // Setup helper: SX quote arrives, no Path-1/Path-2 match, event is created
    // with the quote's sxEventId. This is the precondition for absorb to run.
    function arrangeFreshSxEventForAbsorb(eventOverrides: Record<string, unknown> = {}) {
      // Path-1 by sxEventId returns null, Path-2 by league window returns null,
      // so findOrCreateEventCore creates a new event.
      mockEventFindFirst.mockResolvedValue(null);
      mockEventCreate.mockResolvedValue({
        id: 'event-sx',
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        sport: 'Basketball',
        league: 'NBA',
        startTime: SAMPLE_QUOTE.startTime,
        sxEventId: 'L12345',
        polyEventId: null,
        ...eventOverrides,
      });
      mockMarketUpsert.mockResolvedValue({ id: 'market-1' });
      mockOutcomeFindMany.mockResolvedValue([]);
      mockOutcomeCreate.mockImplementation((args: { data: { label: string } }) =>
        Promise.resolve({ id: `out-${args.data.label}`, ...args.data }),
      );
    }

    it('absorbs a single PM-only twin into a freshly-created SX event', async () => {
      arrangeFreshSxEventForAbsorb();
      // One PM-only twin on the same ET day, no SX id (the kind of orphan
      // produced when PM uses a placeholder time outside the ±2h Path-2 window).
      mockEventFindMany.mockResolvedValue([
        {
          id: 'event-pm-twin',
          league: 'NBA',
          homeTeam: 'Lakers',
          awayTeam: 'Warriors',
          startTime: SAMPLE_QUOTE.startTime,
          sxEventId: null,
          polyEventId: '99999',
        },
      ]);
      mockMarketFindMany.mockResolvedValue([{ id: 'pm-market-1' }, { id: 'pm-market-2' }]);

      const { upsertMarkets } = await import('./markets');
      await upsertMarkets([SAMPLE_QUOTE]);

      // PM markets get re-pointed onto the SX event
      expect(mockMarketUpdateMany).toHaveBeenCalledWith({
        where: { eventId: 'event-pm-twin' },
        data: { eventId: 'event-sx' },
      });
      // PM outcomes' canonical-bet links cleared so they re-link against the SX event
      expect(mockOutcomeUpdateMany).toHaveBeenCalledWith({
        where: { marketId: { in: ['pm-market-1', 'pm-market-2'] } },
        data: { canonicalBetId: null },
      });
      // SX event inherits the twin's polyEventId
      expect(mockEventUpdate).toHaveBeenCalledWith({
        where: { id: 'event-sx' },
        data: { polyEventId: '99999' },
      });
      // Twin event deleted
      expect(mockEventDelete).toHaveBeenCalledWith({ where: { id: 'event-pm-twin' } });
    });

    it('absorbs in the PM-arrives direction (PM event inherits sxEventId from twin)', async () => {
      mockEventFindFirst.mockResolvedValue(null);
      mockEventCreate.mockResolvedValue({
        id: 'event-pm',
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        sport: 'Basketball',
        league: 'NBA',
        startTime: SAMPLE_QUOTE.startTime,
        sxEventId: null,
        polyEventId: '99999',
      });
      mockMarketUpsert.mockResolvedValue({ id: 'market-1' });
      mockOutcomeFindMany.mockResolvedValue([]);
      mockOutcomeCreate.mockImplementation((args: { data: { label: string } }) =>
        Promise.resolve({ id: `out-${args.data.label}`, ...args.data }),
      );
      mockEventFindMany.mockResolvedValue([
        {
          id: 'event-sx-twin',
          league: 'NBA',
          homeTeam: 'Lakers',
          awayTeam: 'Warriors',
          startTime: SAMPLE_QUOTE.startTime,
          sxEventId: 'L12345',
          polyEventId: null,
        },
      ]);
      mockMarketFindMany.mockResolvedValue([{ id: 'sx-market-1' }]);

      const { upsertMarkets } = await import('./markets');
      const polyQuote: MarketQuote = {
        ...SAMPLE_QUOTE,
        platform: 'polymarket',
        sxEventId: undefined,
        polyEventId: '99999',
      };
      await upsertMarkets([polyQuote]);

      expect(mockMarketUpdateMany).toHaveBeenCalledWith({
        where: { eventId: 'event-sx-twin' },
        data: { eventId: 'event-pm' },
      });
      expect(mockEventUpdate).toHaveBeenCalledWith({
        where: { id: 'event-pm' },
        data: { sxEventId: 'L12345' },
      });
      expect(mockEventDelete).toHaveBeenCalledWith({ where: { id: 'event-sx-twin' } });
    });

    it('skips absorb when multiple same-day twins exist (doubleheader safeguard)', async () => {
      arrangeFreshSxEventForAbsorb();
      mockEventFindMany.mockResolvedValue([
        {
          id: 'event-pm-twin-1',
          league: 'NBA',
          homeTeam: 'Lakers',
          awayTeam: 'Warriors',
          startTime: SAMPLE_QUOTE.startTime,
          sxEventId: null,
          polyEventId: '99999',
        },
        {
          id: 'event-pm-twin-2',
          league: 'NBA',
          homeTeam: 'Lakers',
          awayTeam: 'Warriors',
          startTime: SAMPLE_QUOTE.startTime,
          sxEventId: null,
          polyEventId: '88888',
        },
      ]);

      const { upsertMarkets } = await import('./markets');
      await upsertMarkets([SAMPLE_QUOTE]);

      // No absorb: no market re-pointing, no event delete
      expect(mockMarketUpdateMany).not.toHaveBeenCalled();
      expect(mockEventDelete).not.toHaveBeenCalled();
    });

    it('does not absorb candidates from a different ET calendar day', async () => {
      arrangeFreshSxEventForAbsorb();
      // Candidate is within the ±30h SQL window but falls on a different ET day —
      // for NBA back-to-backs (consecutive days, same teams), this prevents the
      // wrong day's game from being merged in.
      const oneDayLater = new Date(SAMPLE_QUOTE.startTime.getTime() + 26 * 60 * 60 * 1000);
      mockEventFindMany.mockResolvedValue([
        {
          id: 'event-different-day',
          league: 'NBA',
          homeTeam: 'Lakers',
          awayTeam: 'Warriors',
          startTime: oneDayLater,
          sxEventId: null,
          polyEventId: '99999',
        },
      ]);

      const { upsertMarkets } = await import('./markets');
      await upsertMarkets([SAMPLE_QUOTE]);

      expect(mockMarketUpdateMany).not.toHaveBeenCalled();
      expect(mockEventDelete).not.toHaveBeenCalled();
    });

    it('runs for non-NBA leagues too (MLB)', async () => {
      mockEventFindFirst.mockResolvedValue(null);
      mockEventCreate.mockResolvedValue({
        id: 'event-mlb-sx',
        homeTeam: 'Rockies',
        awayTeam: 'Mets',
        sport: 'Baseball',
        league: 'MLB',
        startTime: SAMPLE_QUOTE.startTime,
        sxEventId: 'L77777',
        polyEventId: null,
      });
      mockMarketUpsert.mockResolvedValue({ id: 'market-1' });
      mockOutcomeFindMany.mockResolvedValue([]);
      mockOutcomeCreate.mockImplementation((args: { data: { label: string } }) =>
        Promise.resolve({ id: `out-${args.data.label}`, ...args.data }),
      );
      mockEventFindMany.mockResolvedValue([
        {
          id: 'event-mlb-pm-twin',
          league: 'MLB',
          homeTeam: 'Rockies',
          awayTeam: 'Mets',
          startTime: SAMPLE_QUOTE.startTime,
          sxEventId: null,
          polyEventId: '427514',
        },
      ]);
      mockMarketFindMany.mockResolvedValue([{ id: 'mlb-pm-market' }]);

      const mlbQuote: MarketQuote = {
        ...SAMPLE_QUOTE,
        sport: 'Baseball',
        league: 'MLB',
        homeTeam: 'Rockies',
        awayTeam: 'Mets',
        sxEventId: 'L77777',
        outcomes: [
          { label: 'Rockies', impliedOdds: 0.45, liquidityDepth: { availableSize: 1000, topLevels: [] } },
          { label: 'Mets', impliedOdds: 0.57, liquidityDepth: { availableSize: 1000, topLevels: [] } },
        ],
        betType: '12',
      };
      const { upsertMarkets } = await import('./markets');
      await upsertMarkets([mlbQuote]);

      expect(mockMarketUpdateMany).toHaveBeenCalledWith({
        where: { eventId: 'event-mlb-pm-twin' },
        data: { eventId: 'event-mlb-sx' },
      });
      expect(mockEventDelete).toHaveBeenCalledWith({ where: { id: 'event-mlb-pm-twin' } });
    });
  });
});
