import { EventEmitter } from 'events';
import { prisma } from '../db';

const ODDS_PRECISION = BigInt('100000000000000000000'); // 10^20
const USDC_DECIMALS = 1_000_000;

const DEFAULT_TOP_LEVELS = 10;
const MIN_TOP_LEVELS = 3;
const MAX_TOP_LEVELS = 25;
const CONFIG_CACHE_MS = 5_000;

export interface SxOrderRecord {
  orderHash: string;
  marketHash: string;
  status: 'ACTIVE' | 'INACTIVE' | 'FILLED';
  totalBetSize: string; // maker USDC units (6 decimals)
  fillAmount: string;
  percentageOdds: string; // 10^20 scale, maker implied
  isMakerBettingOutcomeOne: boolean;
  updateTime: number;
}

export interface BookLevel {
  odds: number; // taker implied probability
  size: number; // taker USDC
}

export interface BookSides {
  outcomeOne: BookLevel[]; // for taker betting outcomeOne
  outcomeTwo: BookLevel[]; // for taker betting outcomeTwo
}

function deriveLevels(orders: Iterable<SxOrderRecord>, topN: number): BookSides {
  const oneMap = new Map<number, number>(); // taker bets outcomeOne
  const twoMap = new Map<number, number>(); // taker bets outcomeTwo

  for (const o of orders) {
    const makerRemaining = BigInt(o.totalBetSize) - BigInt(o.fillAmount);
    if (makerRemaining <= 0n) continue;

    const pctOdds = BigInt(o.percentageOdds);
    if (pctOdds <= 0n) continue;

    const takerSpace = (makerRemaining * ODDS_PRECISION) / pctOdds - makerRemaining;
    const takerUsdc = Number(takerSpace) / USDC_DECIMALS;
    if (takerUsdc <= 0) continue;

    const makerImplied = Number(o.percentageOdds) / 1e20;
    const takerOdds = parseFloat((1 - makerImplied).toFixed(8));

    // Maker on outcomeOne → taker bets outcomeTwo (twoMap). And vice versa.
    const target = o.isMakerBettingOutcomeOne ? twoMap : oneMap;
    target.set(takerOdds, (target.get(takerOdds) ?? 0) + takerUsdc);
  }

  const toLevels = (m: Map<number, number>): BookLevel[] =>
    Array.from(m.entries())
      .map(([odds, size]) => ({ odds, size }))
      .sort((a, b) => a.odds - b.odds)
      .slice(0, topN);

  return { outcomeOne: toLevels(oneMap), outcomeTwo: toLevels(twoMap) };
}

export class OrderBookCache extends EventEmitter {
  private books = new Map<string, Map<string, SxOrderRecord>>();
  private topLevels = DEFAULT_TOP_LEVELS;
  private configFetchedAt = 0;
  private configInflight: Promise<void> | null = null;

  private async refreshTopLevels(): Promise<void> {
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

  private getOrCreateBook(marketHash: string): Map<string, SxOrderRecord> {
    let book = this.books.get(marketHash);
    if (!book) {
      book = new Map();
      this.books.set(marketHash, book);
    }
    return book;
  }

  replaceMarket(marketHash: string, records: SxOrderRecord[]): void {
    const book = new Map<string, SxOrderRecord>();
    for (const r of records) {
      if (r.status === 'ACTIVE') book.set(r.orderHash, r);
    }
    this.books.set(marketHash, book);
    void this.refreshTopLevels();
    this.emitUpdate(marketHash);
  }

  applyBatch(marketHash: string, records: SxOrderRecord[]): void {
    if (records.length === 0) return;
    const book = this.getOrCreateBook(marketHash);
    let changed = false;
    for (const r of records) {
      const existing = book.get(r.orderHash);
      if (existing && existing.updateTime > r.updateTime) continue;
      if (r.status === 'ACTIVE') {
        book.set(r.orderHash, r);
        changed = true;
      } else {
        if (book.delete(r.orderHash)) changed = true;
      }
    }
    if (!changed) return;
    void this.refreshTopLevels();
    this.emitUpdate(marketHash);
  }

  clearMarket(marketHash: string): void {
    this.books.delete(marketHash);
  }

  getLevels(marketHash: string): BookSides {
    const book = this.books.get(marketHash);
    if (!book) return { outcomeOne: [], outcomeTwo: [] };
    return deriveLevels(book.values(), this.topLevels);
  }

  private emitUpdate(marketHash: string): void {
    const levels = this.getLevels(marketHash);
    this.emit('bookUpdate', { marketHash, ...levels });
  }
}

export const orderBookCache = new OrderBookCache();
