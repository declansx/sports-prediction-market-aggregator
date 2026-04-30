import { describe, it, expect } from 'vitest';
import { computeBestOddsCount, computeWinnerEdge, type MatchedPairInput } from './stats';
import type { MarketGroup } from '../services/marketGroups';

function makeGroup(
  outcomes: Array<{ label: string; platform: 'sx' | 'polymarket'; impliedOdds: number; betType?: string; canonicalKey?: string | null }>,
  startTimeOffset = 0,
): MarketGroup {
  const platforms = [...new Set(outcomes.map((o) => o.platform))];
  return {
    key: 'test-group',
    name: 'Team A vs Team B',
    sport: 'Basketball',
    league: 'NBA',
    startTime: new Date(Date.now() + startTimeOffset),
    sxEventId: null,
    marketIds: ['m1'],
    markets: platforms.map((p) => ({
      id: `m-${p}`,
      eventId: 'e1',
      platform: p,
      externalId: `ext-${p}`,
      sport: 'Basketball',
      league: 'NBA',
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      name: 'Team A vs Team B',
      startTime: new Date(Date.now() + startTimeOffset),
      status: 'active',
      betType: '12',
      line: null,
      mainLine: true,
      sxEventId: null,
      fixtureState: null,
      outcomes: [],
    })),
    outcomes: outcomes.map((o, i) => ({
      outcomeId: `o${i}`,
      label: o.label,
      platform: o.platform,
      externalId: `ext-${i}`,
      impliedOdds: o.impliedOdds,
      liquidityDepth: 100,
      marketId: `m-${o.platform}`,
      betType: o.betType ?? '12',
      line: null,
      mainLine: true,
      canonicalKey: o.canonicalKey === undefined ? `canon-${o.label}` : o.canonicalKey,
    })),
    fixtureState: undefined,
  };
}

describe('computeBestOddsCount', () => {
  it('all-types: SX-only canonical counts as SX coverage win', () => {
    const groups = [
      makeGroup([
        { label: 'Team A', platform: 'sx', impliedOdds: 0.6 },
        { label: 'Team B', platform: 'sx', impliedOdds: 0.4 },
      ]),
    ];
    const result = computeBestOddsCount(groups, false);
    expect(result.sx).toBe(2);
    expect(result.poly).toBe(0);
    expect(result.total).toBe(2);
  });

  it('all-types: Poly-only canonical counts as Poly coverage win', () => {
    const groups = [
      makeGroup([
        { label: 'Team A', platform: 'polymarket', impliedOdds: 0.6 },
        { label: 'Team B', platform: 'polymarket', impliedOdds: 0.4 },
      ]),
    ];
    const result = computeBestOddsCount(groups, false);
    expect(result.sx).toBe(0);
    expect(result.poly).toBe(2);
    expect(result.total).toBe(2);
  });

  it('match-winner: one-sided canonicals are excluded (head-to-head only)', () => {
    // Mix of one-sided and head-to-head canonicals. Only the H2H pair counts.
    const groups = [
      makeGroup([
        { label: 'Team A', platform: 'sx', impliedOdds: 0.6 },
        { label: 'Team A', platform: 'polymarket', impliedOdds: 0.55 },
        { label: 'Team B', platform: 'sx', impliedOdds: 0.4 }, // SX-only canonical
      ]),
    ];
    const mw = computeBestOddsCount(groups, true);
    expect(mw.total).toBe(1); // only Team A pair counts
    expect(mw.poly).toBe(1); // Poly 0.55 < SX 0.6 → Poly wins
    expect(mw.sx).toBe(0);

    const all = computeBestOddsCount(groups, false);
    expect(all.total).toBe(2); // Team A pair + Team B SX coverage
    expect(all.sx).toBe(1);
    expect(all.poly).toBe(1);
  });

  it('lower impliedOdds wins when both platforms present (= better decimal odds)', () => {
    const groups = [
      makeGroup([
        // Team A: SX 0.55 (decimal 1.82) better than Poly 0.60 (1.67) → SX wins
        { label: 'Team A', platform: 'sx', impliedOdds: 0.55 },
        { label: 'Team A', platform: 'polymarket', impliedOdds: 0.60 },
        // Team B: Poly 0.35 (decimal 2.86) better than SX 0.45 (2.22) → Poly wins
        { label: 'Team B', platform: 'sx', impliedOdds: 0.45 },
        { label: 'Team B', platform: 'polymarket', impliedOdds: 0.35 },
      ]),
    ];
    const result = computeBestOddsCount(groups, true);
    expect(result.sx).toBe(1);
    expect(result.poly).toBe(1);
    expect(result.total).toBe(2);
  });

  it('tie goes to SX', () => {
    const groups = [
      makeGroup([
        { label: 'Team A', platform: 'sx', impliedOdds: 0.55 },
        { label: 'Team A', platform: 'polymarket', impliedOdds: 0.55 },
      ]),
    ];
    const result = computeBestOddsCount(groups, true);
    expect(result.sx).toBe(1);
    expect(result.poly).toBe(0);
  });

  it('excludes outcomes without a canonicalKey (no cross-platform link)', () => {
    const groups = [
      makeGroup([
        { label: 'Team A', platform: 'sx', impliedOdds: 0.5, canonicalKey: null },
        { label: 'Team A', platform: 'polymarket', impliedOdds: 0.55, canonicalKey: null },
      ]),
    ];
    const result = computeBestOddsCount(groups, true);
    expect(result.total).toBe(0);
  });

  it('joins by canonicalKey, not label — different labels with same canonical match', () => {
    // SX uses "Bolívar", Polymarket uses "Club Bolivar" — same canonical bet.
    const groups = [
      makeGroup([
        { label: 'Bolívar', platform: 'sx', impliedOdds: 0.45, canonicalKey: 'home-wins' },
        { label: 'Club Bolivar', platform: 'polymarket', impliedOdds: 0.50, canonicalKey: 'home-wins' },
      ]),
    ];
    const result = computeBestOddsCount(groups, true);
    expect(result.sx).toBe(1); // SX 0.45 < Poly 0.50 → SX wins one head-to-head pair
    expect(result.poly).toBe(0);
    expect(result.total).toBe(1);
  });

  it('excludes outcomes where both platforms have 0 odds', () => {
    const groups = [
      makeGroup([
        { label: 'Team A', platform: 'sx', impliedOdds: 0 },
        { label: 'Team A', platform: 'polymarket', impliedOdds: 0 },
      ]),
    ];
    const result = computeBestOddsCount(groups, true);
    expect(result.total).toBe(0);
  });

  it('match-winner mode excludes non-12/1x2 bet types', () => {
    const groups = [
      makeGroup([
        { label: 'Team A -1.5', platform: 'sx', impliedOdds: 0.4, betType: 'spread' },
        { label: 'Team A -1.5', platform: 'polymarket', impliedOdds: 0.45, betType: 'spread' },
      ]),
    ];
    const result = computeBestOddsCount(groups, true);
    expect(result.total).toBe(0);
  });

  it('match-winner mode includes 1x2 outcomes', () => {
    const groups = [
      makeGroup([
        { label: 'Home', platform: 'sx', impliedOdds: 0.45, betType: '1x2' },
        { label: 'Home', platform: 'polymarket', impliedOdds: 0.50, betType: '1x2' },
        { label: 'Draw', platform: 'sx', impliedOdds: 0.30, betType: '1x2' },
        { label: 'Draw', platform: 'polymarket', impliedOdds: 0.28, betType: '1x2' },
      ]),
    ];
    const result = computeBestOddsCount(groups, true);
    expect(result.sx).toBe(1); // Home: SX 0.45 < Poly 0.50
    expect(result.poly).toBe(1); // Draw: Poly 0.28 < SX 0.30
    expect(result.total).toBe(2);
  });

  it('all-types mode includes non-match-winner bet types', () => {
    const groups = [
      makeGroup([
        { label: 'Team A -1.5', platform: 'sx', impliedOdds: 0.4, betType: 'spread' },
        { label: 'Team A -1.5', platform: 'polymarket', impliedOdds: 0.45, betType: 'spread' },
      ]),
    ];
    const result = computeBestOddsCount(groups, false);
    expect(result.sx).toBe(1);
    expect(result.total).toBe(1);
  });

  it('counts across multiple groups', () => {
    const groups = [
      makeGroup([
        // SX 0.6 < Poly 0.7 → SX wins
        { label: 'Team A', platform: 'sx', impliedOdds: 0.6 },
        { label: 'Team A', platform: 'polymarket', impliedOdds: 0.7 },
      ]),
      makeGroup([
        // Poly 0.4 < SX 0.55 → Poly wins
        { label: 'Team C', platform: 'sx', impliedOdds: 0.55 },
        { label: 'Team C', platform: 'polymarket', impliedOdds: 0.4 },
      ]),
    ];
    const result = computeBestOddsCount(groups, true);
    expect(result.sx).toBe(1);
    expect(result.poly).toBe(1);
    expect(result.total).toBe(2);
  });

  it('returns zeros for empty group list', () => {
    const result = computeBestOddsCount([], true);
    expect(result).toEqual({ sx: 0, poly: 0, total: 0 });
  });
});

describe('computeWinnerEdge', () => {
  function pair(
    sxOdds: number,
    polyOdds: number,
    sxLevels: Array<[number, number]>,
    polyLevels: Array<[number, number]>,
    canonicalKey = 'k',
  ): MatchedPairInput {
    return {
      canonicalKey,
      sxOdds,
      polyOdds,
      sxLevels: sxLevels.map(([odds, size]) => ({ odds, size })),
      polyLevels: polyLevels.map(([odds, size]) => ({ odds, size })),
    };
  }

  it('returns null for zero pairs', () => {
    expect(computeWinnerEdge([], 'sx')).toBeNull();
  });

  it('returns null when no pair has the supplied winner ahead', () => {
    // Caller said SX is the winner, but every pair shows Poly ahead (lower implied) → no sample.
    const pairs = [
      pair(0.55, 0.40, [[0.55, 100]], [[0.40, 70]]),
      pair(0.50, 0.45, [[0.50, 100]], [[0.45, 30]]),
    ];
    expect(computeWinnerEdge(pairs, 'sx')).toBeNull();
  });

  it('SX winner: averages SX size strictly below Poly best, only on SX-better pairs', () => {
    const pairs = [
      // SX 0.40 < Poly 0.50 → SX better. Both SX levels strictly below 0.50 → 100 size.
      pair(0.40, 0.50, [[0.40, 100]], [[0.50, 50]]),
      // SX 0.45 < Poly 0.50 → SX better. SX level 0.45 strictly below 0.50 → 80 size.
      pair(0.45, 0.50, [[0.45, 80]], [[0.50, 30]]),
      // Poly better — not in sample.
      pair(0.60, 0.50, [[0.60, 200]], [[0.50, 10]]),
    ];
    const r = computeWinnerEdge(pairs, 'sx');
    expect(r).not.toBeNull();
    expect(r!.venue).toBe('sx');
    expect(r!.sampleCount).toBe(2);
    expect(r!.avgSize).toBe(90); // (100 + 80) / 2
  });

  it('Poly winner: averages Poly size strictly below SX best, only on Poly-better pairs', () => {
    const pairs = [
      // Poly 0.40 < SX 0.55 → Poly better. Poly level 0.40 < 0.55 → 70 size.
      pair(0.55, 0.40, [[0.55, 100]], [[0.40, 70]]),
      // Poly 0.45 < SX 0.50 → Poly better → 30 size.
      pair(0.50, 0.45, [[0.50, 100]], [[0.45, 30]]),
      // SX better — not in sample.
      pair(0.50, 0.60, [[0.50, 100]], [[0.60, 100]]),
    ];
    const r = computeWinnerEdge(pairs, 'poly');
    expect(r).not.toBeNull();
    expect(r!.venue).toBe('poly');
    expect(r!.sampleCount).toBe(2);
    expect(r!.avgSize).toBe(50); // (70 + 30) / 2
  });

  it('only sums size strictly below the loser best (excludes equal levels)', () => {
    // SX 0.50 < Poly 0.55 → SX better. SX has [0.48, 10] (strictly below 0.55) and [0.55, 50] (equal, excluded).
    const pairs = [pair(0.50, 0.55, [[0.48, 10], [0.55, 50]], [[0.55, 100]])];
    const r = computeWinnerEdge(pairs, 'sx');
    expect(r!.avgSize).toBe(10);
  });

  it('returns 0 avg when winner has no levels below loser best', () => {
    const pairs = [pair(0.50, 0.60, [], [[0.60, 100]])];
    const r = computeWinnerEdge(pairs, 'sx');
    expect(r!.venue).toBe('sx');
    expect(r!.sampleCount).toBe(1);
    expect(r!.avgSize).toBe(0);
  });
});
