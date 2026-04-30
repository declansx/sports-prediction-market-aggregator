import { EventEmitter } from 'events';

function applyFee(p: number, feeRate: number): number {
  if (feeRate === 0) return p;
  return p + feeRate * p * (1 - p);
}

export interface PolyOddsEntry {
  tokenId: string;
  bestAsk: number;
  bestBid: number;
  updatedAt: number;
}

export interface PolyOddsBroadcast {
  tokenId: string;
  takerOdds: number;
  updatedAt: number;
}

export class PolymarketOddsCache extends EventEmitter {
  private entries = new Map<string, PolyOddsEntry>();
  // Per-token taker fee rate from V2 `getClobMarketInfo` (fd.r). Unknown tokens default to 0.
  private feeRates = new Map<string, number>();

  setFeeRate(tokenId: string, feeRate: number): void {
    const prev = this.feeRates.get(tokenId);
    this.feeRates.set(tokenId, feeRate);
    if (prev === feeRate) return;
    // Rate changed: re-emit so dashboard subscribers don't keep showing odds
    // that were computed against a stale (or default-zero) rate. Discovery
    // typically registers the rate AFTER the WS service has already seeded
    // the cache for at-startup-subscribed tokens, so without this step the
    // first emission is un-adjusted.
    const entry = this.entries.get(tokenId);
    if (!entry) return;
    const takerOdds = applyFee(entry.bestAsk, feeRate);
    this.emit('polyOddsUpdate', { tokenId, takerOdds, updatedAt: entry.updatedAt });
  }

  getFeeRate(tokenId: string): number {
    return this.feeRates.get(tokenId) ?? 0;
  }

  set(tokenId: string, bestAsk: number, bestBid: number, updatedAt: number): void {
    const existing = this.entries.get(tokenId);
    if (existing && existing.updatedAt >= updatedAt) return;
    const entry: PolyOddsEntry = { tokenId, bestAsk, bestBid, updatedAt };
    this.entries.set(tokenId, entry);
    const takerOdds = applyFee(bestAsk, this.getFeeRate(tokenId));
    const payload: PolyOddsBroadcast = { tokenId, takerOdds, updatedAt };
    this.emit('polyOddsUpdate', payload);
  }

  get(tokenId: string): PolyOddsEntry | undefined {
    return this.entries.get(tokenId);
  }

  getTakerOdds(tokenId: string): number | undefined {
    const e = this.entries.get(tokenId);
    if (!e) return undefined;
    return applyFee(e.bestAsk, this.getFeeRate(tokenId));
  }

  getSnapshot(): PolyOddsBroadcast[] {
    const out: PolyOddsBroadcast[] = [];
    for (const e of this.entries.values()) {
      out.push({
        tokenId: e.tokenId,
        takerOdds: applyFee(e.bestAsk, this.getFeeRate(e.tokenId)),
        updatedAt: e.updatedAt,
      });
    }
    return out;
  }

  has(tokenId: string): boolean {
    return this.entries.has(tokenId);
  }

  clear(tokenId: string): void {
    this.entries.delete(tokenId);
  }

  // Audit helper: list cached tokens that have NEVER had setFeeRate called
  // (the source of "this token's odds aren't fee-adjusted" bugs at startup).
  unregisteredTokens(): string[] {
    const out: string[] = [];
    for (const tokenId of this.entries.keys()) {
      if (!this.feeRates.has(tokenId)) out.push(tokenId);
    }
    return out;
  }

  // Audit helper: list cached tokens whose registered fee rate is 0 (un-adjusted).
  // Includes both "never registered" (set-but-no-rate) and "registered as 0".
  zeroRateTokens(): string[] {
    const out: string[] = [];
    for (const tokenId of this.entries.keys()) {
      if (this.getFeeRate(tokenId) === 0) out.push(tokenId);
    }
    return out;
  }

  // Audit helper: count of registered tokens by exact rate value.
  // Confirms every sports market is on the same 0.03 rate (or surfaces outliers).
  rateDistribution(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const rate of this.feeRates.values()) {
      const key = rate.toString();
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  }
}

export const polymarketOddsCache = new PolymarketOddsCache();
