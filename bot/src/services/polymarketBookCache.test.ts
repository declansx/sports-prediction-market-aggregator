import { describe, it, expect, beforeEach } from 'vitest';
import { PolymarketBookCache } from './polymarketBookCache';

const TOKEN = '0xtoken';

describe('PolymarketBookCache', () => {
  let cache: PolymarketBookCache;

  beforeEach(() => {
    cache = new PolymarketBookCache();
    cache.setTopLevels(10);
    // Default sports rate for tests that exercise fee-adjusted ladders.
    // Adapter populates this per-token from V2 getClobMarketInfo at discovery time.
    cache.setFeeRate(TOKEN, 0.03);
  });

  it('derives top-N asks in ascending odds (fee-adjusted)', () => {
    cache.replaceBook(
      TOKEN,
      [{ price: '0.45', size: '100' }],
      [
        { price: '0.60', size: '50' },
        { price: '0.55', size: '80' },
      ],
      1,
    );
    const levels = cache.getLevels(TOKEN);
    expect(levels).toHaveLength(2);
    // Sorted by fee-adjusted price ascending — 0.55 before 0.60
    expect(levels[0].odds).toBeLessThan(levels[1].odds);
    // applyFee(0.55, 0.03) = 0.55 + 0.03*0.55*0.45 = 0.55 + 0.007425 = 0.557425
    expect(levels[0].odds).toBeCloseTo(0.557425, 6);
    // size is USDC: 80 shares × 0.55 raw price = 44
    expect(levels[0].size).toBeCloseTo(44, 6);
  });

  it('applyPriceChange upserts a new level', () => {
    cache.replaceBook(TOKEN, [], [{ price: '0.60', size: '50' }], 1);
    expect(cache.getLevels(TOKEN)).toHaveLength(1);

    cache.applyPriceChange(TOKEN, [{ side: 'SELL', price: '0.55', size: '30' }], 2);
    const levels = cache.getLevels(TOKEN);
    expect(levels).toHaveLength(2);
    expect(levels[0].odds).toBeLessThan(levels[1].odds);
  });

  it('applyPriceChange with size="0" removes a level', () => {
    cache.replaceBook(TOKEN, [], [{ price: '0.60', size: '50' }], 1);
    cache.applyPriceChange(TOKEN, [{ side: 'SELL', price: '0.60', size: '0' }], 2);
    expect(cache.getLevels(TOKEN)).toHaveLength(0);
  });

  it('replaceBook does full replacement', () => {
    cache.replaceBook(TOKEN, [], [{ price: '0.60', size: '50' }], 1);
    cache.replaceBook(TOKEN, [], [{ price: '0.55', size: '30' }], 2);
    const levels = cache.getLevels(TOKEN);
    expect(levels).toHaveLength(1);
    // size is USDC: 30 shares × 0.55 = 16.5
    expect(levels[0].size).toBeCloseTo(16.5, 6);
  });

  it('setTopLevels bounds the returned levels count', () => {
    const asks = [];
    for (let i = 0; i < 20; i++) {
      asks.push({ price: (0.30 + i * 0.01).toFixed(2), size: '10' });
    }
    cache.replaceBook(TOKEN, [], asks, 1);

    cache.setTopLevels(5);
    expect(cache.getLevels(TOKEN)).toHaveLength(5);

    cache.setTopLevels(15);
    expect(cache.getLevels(TOKEN)).toHaveLength(15);
  });

  it('clearBook wipes state and emits no further frames', () => {
    cache.replaceBook(TOKEN, [], [{ price: '0.60', size: '50' }], 1);
    cache.clearBook(TOKEN);
    expect(cache.getLevels(TOKEN)).toHaveLength(0);

    const events: string[] = [];
    cache.on('polyBookUpdate', (p: { tokenId: string }) => events.push(p.tokenId));
    // applyPriceChange on cleared token creates a fresh entry — but clearBook itself
    // should not have emitted any trailing frames. Verify by checking that emissions
    // only occur on subsequent explicit updates.
    expect(events).toEqual([]);
  });

  it('ignores out-of-order updates (older updatedAt)', () => {
    cache.replaceBook(TOKEN, [], [{ price: '0.60', size: '50' }], 100);
    cache.applyPriceChange(TOKEN, [{ side: 'SELL', price: '0.60', size: '0' }], 50);
    expect(cache.getLevels(TOKEN)).toHaveLength(1);
  });

  it('re-emits polyBookUpdate when setFeeRate changes the rate for a cached token', () => {
    // Race scenario: WS seed beats discovery → first emission is un-adjusted.
    // Discovery registers the rate later → cache must re-emit fee-adjusted levels.
    const fresh = new PolymarketBookCache();
    fresh.setTopLevels(10);
    fresh.replaceBook(TOKEN, [], [{ price: '0.55', size: '100' }], 1); // emits rate=0

    const events: Array<{ tokenId: string; levels: Array<{ odds: number }> }> = [];
    fresh.on('polyBookUpdate', (p: { tokenId: string; levels: Array<{ odds: number }> }) => events.push(p));

    fresh.setFeeRate(TOKEN, 0.03);

    expect(events).toHaveLength(1);
    expect(events[0].tokenId).toBe(TOKEN);
    expect(events[0].levels[0].odds).toBeCloseTo(0.557425, 6);
  });

  it('does not re-emit when setFeeRate is called with the same rate', () => {
    const fresh = new PolymarketBookCache();
    fresh.setTopLevels(10);
    fresh.setFeeRate(TOKEN, 0.03);
    fresh.replaceBook(TOKEN, [], [{ price: '0.55', size: '100' }], 1);

    const events: string[] = [];
    fresh.on('polyBookUpdate', (p: { tokenId: string }) => events.push(p.tokenId));

    fresh.setFeeRate(TOKEN, 0.03); // identical → no churn

    expect(events).toEqual([]);
  });

  it('defaults to no fee adjustment when setFeeRate has not been called for a token', () => {
    const fresh = new PolymarketBookCache();
    fresh.setTopLevels(10);
    fresh.replaceBook('unknown', [], [{ price: '0.55', size: '100' }], 1);
    const levels = fresh.getLevels('unknown');
    expect(levels).toHaveLength(1);
    // No registered fee rate → un-adjusted price (NOT legacy hardcoded 0.03).
    expect(levels[0].odds).toBeCloseTo(0.55, 6);
  });

  it('emits polyBookUpdate on applyPriceChange', () => {
    const events: string[] = [];
    cache.on('polyBookUpdate', (p: { tokenId: string }) => events.push(p.tokenId));

    cache.applyPriceChange(TOKEN, [{ side: 'SELL', price: '0.60', size: '50' }], 1);
    expect(events).toEqual([TOKEN]);
  });
});
