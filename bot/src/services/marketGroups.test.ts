import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock('../db', () => ({
  prisma: { market: { findMany: mockFindMany } },
}));

import { oddsCache } from './oddsCache';
import { polymarketOddsCache } from './polymarketOddsCache';
import { fixtureStateCache, FIXTURE_STATUS } from './fixtureStateCache';
import { getMarketGroups, matchGroupKey } from './marketGroups';

function market(overrides: Partial<{
  id: string;
  eventId: string;
  platform: 'sx' | 'polymarket';
  externalId: string;
  betType: string;
  line: number | null;
  mainLine: boolean;
  homeTeam: string;
  awayTeam: string;
  sport: string;
  league: string;
  sxEventId: string | null;
  startTime: Date;
  outcomes: Array<{ id: string; label: string; externalId: string | null; currentOdds: number; liquidityDepth: number }>;
}> = {}) {
  return {
    id: overrides.id ?? 'm1',
    eventId: overrides.eventId ?? 'e1',
    platform: overrides.platform ?? 'sx',
    externalId: overrides.externalId ?? '0xhash',
    startTime: overrides.startTime ?? new Date('2026-05-01T18:00:00Z'),
    status: 'active',
    betType: overrides.betType ?? '1x2',
    line: overrides.line ?? null,
    mainLine: overrides.mainLine ?? true,
    event: {
      id: overrides.eventId ?? 'e1',
      sport: overrides.sport ?? 'Soccer',
      league: overrides.league ?? 'EPL',
      homeTeam: overrides.homeTeam ?? 'Arsenal',
      awayTeam: overrides.awayTeam ?? 'Chelsea',
      sxEventId: overrides.sxEventId === undefined ? 'L1' : overrides.sxEventId,
      status: 'active',
      startTime: overrides.startTime ?? new Date('2026-05-01T18:00:00Z'),
    },
    outcomes: overrides.outcomes ?? [
      { id: 'o1', label: overrides.homeTeam ?? 'Arsenal', externalId: `${overrides.externalId ?? '0xhash'}:0`, currentOdds: 0.5, liquidityDepth: 1000 },
      { id: 'o2', label: overrides.awayTeam ?? 'Chelsea', externalId: `${overrides.externalId ?? '0xhash'}:1`, currentOdds: 0.5, liquidityDepth: 1000 },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Clean singleton caches between tests.
  for (const e of oddsCache.getSnapshot()) {
    // Force-reset: re-set with a stale ts+1 would not help; we just rely on no collision across tests by using distinct hashes.
    void e;
  }
  // These singletons don't expose clear(); tests use fresh keys to avoid collision.
});

describe('matchGroupKey', () => {
  const t = new Date('2026-05-01T19:00:00Z');
  it('produces identical keys for reversed team-name pairs at the same time', () => {
    expect(matchGroupKey('A vs B', 'Soccer', 'EPL', t)).toBe(matchGroupKey('B vs A', 'Soccer', 'EPL', t));
  });
  it('differs across sport or league', () => {
    expect(matchGroupKey('A vs B', 'Soccer', 'EPL', t)).not.toBe(matchGroupKey('A vs B', 'Soccer', 'LaLiga', t));
    expect(matchGroupKey('A vs B', 'Soccer', 'EPL', t)).not.toBe(matchGroupKey('A vs B', 'Basketball', 'EPL', t));
  });
  it('differs across different days (separate games for same team pair)', () => {
    const t1 = new Date('2026-05-01T19:00:00Z');
    const t2 = new Date('2026-05-02T19:00:00Z');
    expect(matchGroupKey('A vs B', 'Basketball', 'NBA', t1)).not.toBe(matchGroupKey('A vs B', 'Basketball', 'NBA', t2));
  });
  it('matches across small time deltas (same game, slightly different platform startTimes)', () => {
    const t1 = new Date('2026-05-01T19:00:00Z');
    const t2 = new Date('2026-05-01T19:30:00Z');
    expect(matchGroupKey('A vs B', 'Basketball', 'NBA', t1)).toBe(matchGroupKey('A vs B', 'Basketball', 'NBA', t2));
  });
});

describe('getMarketGroups', () => {
  it('merges SX + Polymarket markets with different Event rows into one group', async () => {
    const sxM = market({
      id: 'sx1', eventId: 'e-sx', platform: 'sx', externalId: '0xgrp1',
      sxEventId: 'L-grp1',
      homeTeam: 'TeamA', awayTeam: 'TeamB',
    });
    const polyM = market({
      id: 'poly1', eventId: 'e-poly', platform: 'polymarket', externalId: 'poly-grp1',
      sxEventId: null,
      homeTeam: 'TeamA', awayTeam: 'TeamB',
      outcomes: [
        { id: 'po1', label: 'TeamA', externalId: 'poly-token-a', currentOdds: 0.51, liquidityDepth: 800 },
        { id: 'po2', label: 'TeamB', externalId: 'poly-token-b', currentOdds: 0.49, liquidityDepth: 800 },
      ],
    });
    mockFindMany.mockResolvedValue([sxM, polyM]);

    const groups = await getMarketGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].marketIds.sort()).toEqual(['poly1', 'sx1']);
    expect(groups[0].sxEventId).toBe('L-grp1');
    const platforms = new Set(groups[0].outcomes.map((o) => o.platform));
    expect(platforms).toEqual(new Set(['sx', 'polymarket']));
  });

  it('collapses reversed team-name pairs into one group', async () => {
    const a = market({
      id: 'm-a', externalId: '0xgrp2a', sxEventId: 'L-grp2a',
      homeTeam: 'Home', awayTeam: 'Away',
    });
    const b = market({
      id: 'm-b', externalId: '0xgrp2b', sxEventId: 'L-grp2b',
      homeTeam: 'Away', awayTeam: 'Home',
    });
    mockFindMany.mockResolvedValue([a, b]);

    const groups = await getMarketGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].marketIds.sort()).toEqual(['m-a', 'm-b']);
  });

  it('includes games with startTime more than 14 days in the future', async () => {
    const farFuture = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
    mockFindMany.mockResolvedValue([
      market({ id: 'far', externalId: '0xgrp3', sxEventId: 'L-grp3', startTime: farFuture }),
    ]);

    const groups = await getMarketGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].startTime.getTime()).toBe(farFuture.getTime());
  });

  it('overlays SX live odds from oddsCache onto matching outcomes', async () => {
    const hash = '0xgrp4';
    oddsCache.set({ marketHash: hash, isMakerBettingOutcomeOne: false, takerOdds: 0.77, updatedAt: Date.now() });
    mockFindMany.mockResolvedValue([
      market({
        id: 'sx4', externalId: hash, sxEventId: 'L-grp4',
        homeTeam: 'X', awayTeam: 'Y',
        outcomes: [
          { id: 'o-a', label: 'X', externalId: `${hash}:0`, currentOdds: 0.1, liquidityDepth: 500 },
          { id: 'o-b', label: 'Y', externalId: `${hash}:1`, currentOdds: 0.9, liquidityDepth: 500 },
        ],
      }),
    ]);

    const groups = await getMarketGroups();
    const o = groups[0].outcomes.find((x) => x.label === 'X');
    expect(o?.impliedOdds).toBeCloseTo(0.77);
  });

  it('overlays Polymarket live odds from polymarketOddsCache onto matching outcomes', async () => {
    // V2 fee rates are populated per-token by the adapter at discovery — register the sports
    // rate explicitly so getTakerOdds adjusts the bestAsk (the cache no longer hardcodes 0.03).
    polymarketOddsCache.setFeeRate('poly-tok-5', 0.03);
    polymarketOddsCache.set('poly-tok-5', 0.62, 0.60, Date.now());
    mockFindMany.mockResolvedValue([
      market({
        id: 'poly5', platform: 'polymarket', externalId: 'pmk5', sxEventId: 'L-grp5',
        homeTeam: 'P', awayTeam: 'Q',
        outcomes: [
          { id: 'po-p', label: 'P', externalId: 'poly-tok-5', currentOdds: 0.3, liquidityDepth: 100 },
          { id: 'po-q', label: 'Q', externalId: 'poly-tok-5-other', currentOdds: 0.7, liquidityDepth: 100 },
        ],
      }),
    ]);

    const groups = await getMarketGroups();
    const o = groups[0].outcomes.find((x) => x.label === 'P');
    // getTakerOdds applies a 3% fee, so result should be >= bestAsk.
    expect(o?.impliedOdds).toBeGreaterThan(0.62);
    expect(o?.impliedOdds).not.toBe(0.3);
  });

  it('falls back to DB currentOdds when no live entry exists', async () => {
    mockFindMany.mockResolvedValue([
      market({
        id: 'sx6', externalId: '0xgrp6-nolive', sxEventId: 'L-grp6',
        homeTeam: 'Z', awayTeam: 'W',
        outcomes: [
          { id: 'o-z', label: 'Z', externalId: '0xgrp6-nolive:0', currentOdds: 0.42, liquidityDepth: 100 },
          { id: 'o-w', label: 'W', externalId: '0xgrp6-nolive:1', currentOdds: 0.58, liquidityDepth: 100 },
        ],
      }),
    ]);

    const groups = await getMarketGroups();
    const z = groups[0].outcomes.find((x) => x.label === 'Z');
    expect(z?.impliedOdds).toBe(0.42);
  });

  it('exposes canonicalKey from canonicalBet relation on outcomes', async () => {
    const m = market({
      id: 'sx-canon', externalId: '0xcanon', sxEventId: 'L-canon',
      homeTeam: 'C1', awayTeam: 'C2',
      outcomes: [
        { id: 'oc1', label: 'C1', externalId: '0xcanon:0', currentOdds: 0.5, liquidityDepth: 100 },
        { id: 'oc2', label: 'C2', externalId: '0xcanon:1', currentOdds: 0.5, liquidityDepth: 100 },
      ],
    });
    // Inject canonicalBet relations on the outcomes
    m.outcomes[0] = { ...m.outcomes[0], canonicalBet: { key: '1x2:home' } } as typeof m.outcomes[0];
    m.outcomes[1] = { ...m.outcomes[1], canonicalBet: { key: '1x2:away' } } as typeof m.outcomes[1];
    mockFindMany.mockResolvedValue([m]);

    const groups = await getMarketGroups();
    const homeRow = groups[0].outcomes.find((o) => o.label === 'C1');
    const awayRow = groups[0].outcomes.find((o) => o.label === 'C2');
    expect(homeRow?.canonicalKey).toBe('1x2:home');
    expect(awayRow?.canonicalKey).toBe('1x2:away');
  });

  it('filters out groups whose sxEventId is in terminal-status cache', async () => {
    const terminalSxId = 'L-terminal-7';
    fixtureStateCache.set({
      sxEventId: terminalSxId,
      status: FIXTURE_STATUS.FINISHED,
      teamOneScore: 2, teamTwoScore: 1,
      currentPeriod: '', periodTime: '', periods: [],
      updatedAt: Date.now(),
    });
    mockFindMany.mockResolvedValue([
      market({ id: 'sx7', externalId: '0xgrp7', sxEventId: terminalSxId, homeTeam: 'Q1', awayTeam: 'Q2' }),
      market({ id: 'sx8', externalId: '0xgrp8', sxEventId: 'L-active-8', homeTeam: 'R1', awayTeam: 'R2' }),
    ]);

    const groups = await getMarketGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].sxEventId).toBe('L-active-8');
  });
});
