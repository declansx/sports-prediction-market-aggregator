import { EventEmitter } from 'events';
import { prisma } from '../db';

const DEFAULT_TOP_LEVELS = 10;
const MIN_TOP_LEVELS = 3;
const MAX_TOP_LEVELS = 25;
const CONFIG_CACHE_MS = 5_000;

function applyFee(p: number, feeRate: number): number {
  if (feeRate === 0) return p;
  return p + feeRate * p * (1 - p);
}

export interface ClobLevel {
  price: string;
  size: string;
}

export interface PriceChange {
  side: 'BUY' | 'SELL'; // BUY = bid, SELL = ask
  price: string;
  size: string; // "0" means remove
}

export interface BookLevel {
  odds: number; // fee-adjusted taker odds
  size: number; // taker USDC (shares × raw price), matching SX cache + adapter snapshot convention
}

export class PolymarketBookCache extends EventEmitter {
  private books = new Map<string, { asks: Map<string, number>; bids: Map<string, number>; updatedAt: number }>();
  // Per-token taker fee rate sourced from V2 `getClobMarketInfo` (fd.r). Unknown tokens default to 0
  // (un-adjusted), not the legacy 0.03 — better to under-show fees than to guess wrong post-V2.
  private feeRates = new Map<string, number>();
  private topLevels = DEFAULT_TOP_LEVELS;
  private configFetchedAt = 0;
  private configInflight: Promise<void> | null = null;

  async refreshTopLevels(): Promise<void> {
    if (Date.now() - this.configFetchedAt < CONFIG_CACHE_MS) return;
    if (this.configInflight) return this.configInflight;
    this.configInflight = (async () => {
      try {
        const row = await prisma.botConfig.findUnique({ where: { key: 'orderBookLevels' } });
        const parsed = row ? parseInt(row.value, 10) : NaN;
        if (!isNaN(parsed)) {
          this.topLevels = Math.max(MIN_TOP_LEVELS, Math.min(MAX_TOP_LEVELS, parsed));
        }
        this.configFetchedAt = Date.now();
      } catch {
        this.configFetchedAt = Date.now();
      } finally {
        this.configInflight = null;
      }
    })();
    return this.configInflight;
  }

  setTopLevels(n: number): void {
    this.topLevels = Math.max(MIN_TOP_LEVELS, Math.min(MAX_TOP_LEVELS, n));
    this.configFetchedAt = Date.now();
  }

  getTopLevels(): number {
    return this.topLevels;
  }

  setFeeRate(tokenId: string, feeRate: number): void {
    const prev = this.feeRates.get(tokenId);
    this.feeRates.set(tokenId, feeRate);
    if (prev === feeRate) return;
    // Rate changed: re-emit so dashboard ladder subscribers don't keep showing
    // levels priced against a stale (or default-zero) rate. Discovery typically
    // registers the rate AFTER the WS service has already seeded the book for
    // at-startup-subscribed tokens.
    if (this.books.has(tokenId)) this.emitUpdate(tokenId);
  }

  getFeeRate(tokenId: string): number {
    return this.feeRates.get(tokenId) ?? 0;
  }

  private getOrCreate(tokenId: string) {
    let entry = this.books.get(tokenId);
    if (!entry) {
      entry = { asks: new Map(), bids: new Map(), updatedAt: 0 };
      this.books.set(tokenId, entry);
    }
    return entry;
  }

  replaceBook(tokenId: string, bids: ClobLevel[], asks: ClobLevel[], updatedAt: number): void {
    const entry = this.getOrCreate(tokenId);
    if (updatedAt < entry.updatedAt) return;
    entry.asks = new Map();
    entry.bids = new Map();
    for (const a of asks) {
      const size = parseFloat(a.size);
      if (size > 0) entry.asks.set(a.price, size);
    }
    for (const b of bids) {
      const size = parseFloat(b.size);
      if (size > 0) entry.bids.set(b.price, size);
    }
    entry.updatedAt = updatedAt;
    void this.refreshTopLevels();
    this.emitUpdate(tokenId);
  }

  applyPriceChange(tokenId: string, changes: PriceChange[], updatedAt: number): void {
    if (changes.length === 0) return;
    const entry = this.getOrCreate(tokenId);
    if (updatedAt < entry.updatedAt) return;
    let changed = false;
    for (const c of changes) {
      const target = c.side === 'SELL' ? entry.asks : entry.bids;
      if (c.size === '0' || parseFloat(c.size) <= 0) {
        if (target.delete(c.price)) changed = true;
      } else {
        target.set(c.price, parseFloat(c.size));
        changed = true;
      }
    }
    if (!changed) return;
    entry.updatedAt = updatedAt;
    void this.refreshTopLevels();
    this.emitUpdate(tokenId);
  }

  clearBook(tokenId: string): void {
    this.books.delete(tokenId);
  }

  getLevels(tokenId: string): BookLevel[] {
    const entry = this.books.get(tokenId);
    if (!entry) return [];
    const feeRate = this.getFeeRate(tokenId);
    // Taker buys at ask → sort asks ascending (lowest price = best odds)
    return Array.from(entry.asks.entries())
      .map(([price, shares]) => {
        const rawPrice = parseFloat(price);
        return {
          odds: applyFee(rawPrice, feeRate),
          size: shares * rawPrice,
        };
      })
      .sort((a, b) => a.odds - b.odds)
      .slice(0, this.topLevels);
  }

  hasToken(tokenId: string): boolean {
    return this.books.has(tokenId);
  }

  private emitUpdate(tokenId: string): void {
    const levels = this.getLevels(tokenId);
    this.emit('polyBookUpdate', { tokenId, levels });
  }
}

export const polymarketBookCache = new PolymarketBookCache();
