import { describe, it, expect, beforeEach } from 'vitest';
import { OrderBookCache, type SxOrderRecord } from './orderBookCache';

const ODDS_PRECISION = BigInt('100000000000000000000');
const USDC_DECIMALS = 1_000_000;

function mkOrder(partial: Partial<SxOrderRecord> & {
  orderHash: string;
  percentageOdds: string;
  totalBetSize: string;
  isMakerBettingOutcomeOne: boolean;
}): SxOrderRecord {
  return {
    marketHash: '0xmkt',
    status: 'ACTIVE',
    fillAmount: '0',
    updateTime: Date.now(),
    ...partial,
  };
}

// 10 USDC of maker liquidity at maker-implied 0.40 → taker side gets (10/0.40 - 10) = 15 USDC at taker odds 0.60
const MAKER_10_USDC = String(10 * USDC_DECIMALS);
// percentageOdds = 0.40 * 10^20
const PCT_40 = String((40n * ODDS_PRECISION) / 100n);
const PCT_50 = String((50n * ODDS_PRECISION) / 100n);

describe('OrderBookCache', () => {
  let cache: OrderBookCache;

  beforeEach(() => {
    cache = new OrderBookCache();
    cache.setTopLevels(10);
  });

  it('derives top-N levels per side from ACTIVE orders', () => {
    cache.replaceMarket('0xmkt', [
      mkOrder({
        orderHash: 'a',
        percentageOdds: PCT_40,
        totalBetSize: MAKER_10_USDC,
        isMakerBettingOutcomeOne: true, // maker on One → taker bets Two
      }),
      mkOrder({
        orderHash: 'b',
        percentageOdds: PCT_50,
        totalBetSize: MAKER_10_USDC,
        isMakerBettingOutcomeOne: false, // maker on Two → taker bets One
      }),
    ]);

    const { outcomeOne, outcomeTwo } = cache.getLevels('0xmkt');
    expect(outcomeOne).toHaveLength(1); // from maker-on-Two order
    expect(outcomeTwo).toHaveLength(1); // from maker-on-One order
    expect(outcomeOne[0].odds).toBeCloseTo(0.5, 6);
    expect(outcomeTwo[0].odds).toBeCloseTo(0.6, 6);
  });

  it('removes orders when status becomes INACTIVE', () => {
    cache.replaceMarket('0xmkt', [
      mkOrder({
        orderHash: 'a',
        percentageOdds: PCT_40,
        totalBetSize: MAKER_10_USDC,
        isMakerBettingOutcomeOne: true,
      }),
    ]);
    expect(cache.getLevels('0xmkt').outcomeTwo).toHaveLength(1);

    cache.applyBatch('0xmkt', [
      mkOrder({
        orderHash: 'a',
        status: 'INACTIVE',
        percentageOdds: PCT_40,
        totalBetSize: MAKER_10_USDC,
        isMakerBettingOutcomeOne: true,
        updateTime: Date.now() + 1000,
      }),
    ]);
    expect(cache.getLevels('0xmkt').outcomeTwo).toHaveLength(0);
  });

  it('ignores out-of-order updates (older updateTime)', () => {
    const t0 = Date.now();
    cache.replaceMarket('0xmkt', [
      mkOrder({
        orderHash: 'a',
        percentageOdds: PCT_40,
        totalBetSize: MAKER_10_USDC,
        isMakerBettingOutcomeOne: true,
        updateTime: t0 + 500,
      }),
    ]);

    // Arrives out of order with earlier timestamp → should be ignored
    cache.applyBatch('0xmkt', [
      mkOrder({
        orderHash: 'a',
        status: 'INACTIVE',
        percentageOdds: PCT_40,
        totalBetSize: MAKER_10_USDC,
        isMakerBettingOutcomeOne: true,
        updateTime: t0, // older
      }),
    ]);

    expect(cache.getLevels('0xmkt').outcomeTwo).toHaveLength(1);
  });

  it('setTopLevels bounds the returned levels count', () => {
    const orders: SxOrderRecord[] = [];
    for (let i = 0; i < 20; i++) {
      const pct = String(((10n + BigInt(i)) * ODDS_PRECISION) / 100n);
      orders.push(
        mkOrder({
          orderHash: `o${i}`,
          percentageOdds: pct,
          totalBetSize: MAKER_10_USDC,
          isMakerBettingOutcomeOne: true,
        }),
      );
    }
    cache.replaceMarket('0xmkt', orders);

    cache.setTopLevels(5);
    expect(cache.getLevels('0xmkt').outcomeTwo).toHaveLength(5);

    cache.setTopLevels(15);
    expect(cache.getLevels('0xmkt').outcomeTwo).toHaveLength(15);
  });

  it('emits bookUpdate on applyBatch with changes', () => {
    const events: string[] = [];
    cache.on('bookUpdate', (payload: { marketHash: string }) => events.push(payload.marketHash));

    cache.applyBatch('0xmkt', [
      mkOrder({
        orderHash: 'a',
        percentageOdds: PCT_40,
        totalBetSize: MAKER_10_USDC,
        isMakerBettingOutcomeOne: true,
      }),
    ]);

    expect(events).toEqual(['0xmkt']);
  });

  it('clearMarket removes all state', () => {
    cache.replaceMarket('0xmkt', [
      mkOrder({
        orderHash: 'a',
        percentageOdds: PCT_40,
        totalBetSize: MAKER_10_USDC,
        isMakerBettingOutcomeOne: true,
      }),
    ]);
    cache.clearMarket('0xmkt');
    expect(cache.getLevels('0xmkt').outcomeOne).toHaveLength(0);
    expect(cache.getLevels('0xmkt').outcomeTwo).toHaveLength(0);
  });
});
