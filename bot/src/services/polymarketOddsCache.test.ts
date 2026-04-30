import { describe, it, expect, beforeEach } from 'vitest';
import { PolymarketOddsCache, type PolyOddsBroadcast } from './polymarketOddsCache';

const TOKEN = '0xtoken';

// applyFee(0.55, 0.03) = 0.55 + 0.03 * 0.55 * 0.45 = 0.557425
const FEE_ADJUSTED_055 = 0.557425;

describe('PolymarketOddsCache', () => {
  let cache: PolymarketOddsCache;

  beforeEach(() => {
    cache = new PolymarketOddsCache();
    // Default sports rate for tests that exercise fee-adjusted taker odds.
    // Adapter populates this per-token from V2 getClobMarketInfo at discovery time.
    cache.setFeeRate(TOKEN, 0.03);
    cache.setFeeRate('a', 0.03);
    cache.setFeeRate('b', 0.03);
  });

  it('set + get round-trip', () => {
    cache.set(TOKEN, 0.55, 0.45, 100);
    const entry = cache.get(TOKEN);
    expect(entry).toBeDefined();
    expect(entry!.bestAsk).toBe(0.55);
    expect(entry!.bestBid).toBe(0.45);
    expect(entry!.updatedAt).toBe(100);
  });

  it('getTakerOdds returns fee-adjusted ask', () => {
    cache.set(TOKEN, 0.55, 0.45, 100);
    expect(cache.getTakerOdds(TOKEN)).toBeCloseTo(FEE_ADJUSTED_055, 6);
  });

  it('emits polyOddsUpdate with post-fee takerOdds on set', () => {
    const events: PolyOddsBroadcast[] = [];
    cache.on('polyOddsUpdate', (p: PolyOddsBroadcast) => events.push(p));
    cache.set(TOKEN, 0.55, 0.45, 100);
    expect(events).toHaveLength(1);
    expect(events[0].tokenId).toBe(TOKEN);
    expect(events[0].takerOdds).toBeCloseTo(FEE_ADJUSTED_055, 6);
    expect(events[0].updatedAt).toBe(100);
  });

  it('drops out-of-order updates with older updatedAt', () => {
    cache.set(TOKEN, 0.55, 0.45, 100);
    const events: PolyOddsBroadcast[] = [];
    cache.on('polyOddsUpdate', (p) => events.push(p));
    cache.set(TOKEN, 0.99, 0.01, 50);
    expect(events).toHaveLength(0);
    expect(cache.get(TOKEN)!.bestAsk).toBe(0.55);
  });

  it('accepts equal-or-newer updates overwrite only on newer', () => {
    cache.set(TOKEN, 0.55, 0.45, 100);
    cache.set(TOKEN, 0.60, 0.40, 100); // equal — should drop
    expect(cache.get(TOKEN)!.bestAsk).toBe(0.55);
    cache.set(TOKEN, 0.60, 0.40, 101);
    expect(cache.get(TOKEN)!.bestAsk).toBe(0.60);
  });

  it('getSnapshot returns all entries with post-fee odds', () => {
    cache.set('a', 0.55, 0.45, 100);
    cache.set('b', 0.30, 0.70, 200);
    const snap = cache.getSnapshot();
    expect(snap).toHaveLength(2);
    const byToken = Object.fromEntries(snap.map((s) => [s.tokenId, s]));
    expect(byToken.a.takerOdds).toBeCloseTo(FEE_ADJUSTED_055, 6);
    expect(byToken.b.updatedAt).toBe(200);
  });

  it('defaults to no fee adjustment when setFeeRate has not been called for a token', () => {
    const fresh = new PolymarketOddsCache();
    fresh.set('unknown', 0.55, 0.45, 100);
    expect(fresh.getTakerOdds('unknown')).toBeCloseTo(0.55, 6);
  });

  it('re-emits polyOddsUpdate when setFeeRate changes the rate for a cached token', () => {
    // Race scenario: WS seed beats discovery → first emission is un-adjusted.
    // Discovery registers the rate later → cache must re-emit so dashboards correct.
    const fresh = new PolymarketOddsCache();
    fresh.set('tok', 0.55, 0.45, 100); // emits with rate=0
    const events: PolyOddsBroadcast[] = [];
    fresh.on('polyOddsUpdate', (p) => events.push(p));

    fresh.setFeeRate('tok', 0.03);

    expect(events).toHaveLength(1);
    expect(events[0].tokenId).toBe('tok');
    expect(events[0].takerOdds).toBeCloseTo(FEE_ADJUSTED_055, 6);
  });

  it('does not re-emit when setFeeRate is called with the same rate', () => {
    const fresh = new PolymarketOddsCache();
    fresh.setFeeRate('tok', 0.03);
    fresh.set('tok', 0.55, 0.45, 100);
    const events: PolyOddsBroadcast[] = [];
    fresh.on('polyOddsUpdate', (p) => events.push(p));

    fresh.setFeeRate('tok', 0.03); // identical → no churn

    expect(events).toHaveLength(0);
  });

  it('clear removes entry', () => {
    cache.set(TOKEN, 0.55, 0.45, 100);
    cache.clear(TOKEN);
    expect(cache.get(TOKEN)).toBeUndefined();
    expect(cache.has(TOKEN)).toBe(false);
  });
});
