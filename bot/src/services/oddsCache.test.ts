import { describe, it, expect, beforeEach } from 'vitest';
import { OddsCache, type BestOddsEntry } from './oddsCache';

// Re-export the class for testing (we'll import it differently below)
// We test via the exported singleton to keep it simple, but we need
// a fresh instance per test to avoid state leakage.

describe('OddsCache', () => {
  let cache: OddsCache;

  beforeEach(() => {
    cache = new OddsCache();
  });

  it('set() emits update event with the new entry', () => {
    const entry: BestOddsEntry = {
      marketHash: '0xabc',
      isMakerBettingOutcomeOne: false,
      takerOdds: 0.55,
      updatedAt: 1000,
    };

    let emitted: BestOddsEntry | undefined;
    cache.on('update', (e: BestOddsEntry) => { emitted = e; });
    cache.set(entry);

    expect(emitted).toEqual(entry);
  });

  it('getSnapshot() returns all stored entries', () => {
    const e1: BestOddsEntry = { marketHash: '0xaaa', isMakerBettingOutcomeOne: false, takerOdds: 0.5, updatedAt: 1 };
    const e2: BestOddsEntry = { marketHash: '0xbbb', isMakerBettingOutcomeOne: true, takerOdds: 0.3, updatedAt: 1 };
    cache.set(e1);
    cache.set(e2);

    const snap = cache.getSnapshot();
    expect(snap).toHaveLength(2);
    expect(snap).toContainEqual(e1);
    expect(snap).toContainEqual(e2);
  });

  it('set() with an older updatedAt does not overwrite a newer entry', () => {
    const newer: BestOddsEntry = { marketHash: '0xabc', isMakerBettingOutcomeOne: false, takerOdds: 0.55, updatedAt: 2000 };
    const older: BestOddsEntry = { marketHash: '0xabc', isMakerBettingOutcomeOne: false, takerOdds: 0.40, updatedAt: 1000 };

    cache.set(newer);
    cache.set(older); // should be ignored

    const snap = cache.getSnapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0].takerOdds).toBe(0.55);
  });

  it('set() with equal updatedAt does not overwrite', () => {
    const first: BestOddsEntry = { marketHash: '0xabc', isMakerBettingOutcomeOne: false, takerOdds: 0.55, updatedAt: 1000 };
    const second: BestOddsEntry = { marketHash: '0xabc', isMakerBettingOutcomeOne: false, takerOdds: 0.40, updatedAt: 1000 };

    cache.set(first);
    cache.set(second);

    expect(cache.getSnapshot()[0].takerOdds).toBe(0.55);
  });
});
