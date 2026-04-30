import { EventEmitter } from 'events';
import { createLogger } from '../logger';

const log = createLogger('oddsCache');

export interface BestOddsEntry {
  marketHash: string;
  isMakerBettingOutcomeOne: boolean;
  takerOdds: number;
  updatedAt: number;
}

export class OddsCache extends EventEmitter {
  private cache = new Map<string, BestOddsEntry>();

  set(entry: BestOddsEntry): void {
    const key = `${entry.marketHash}:${entry.isMakerBettingOutcomeOne}`;
    const existing = this.cache.get(key);
    if (existing && existing.updatedAt >= entry.updatedAt) {
      log.trace({ key, existingTs: existing.updatedAt, newTs: entry.updatedAt }, 'dropped stale');
      return;
    }
    log.trace({ key, takerOdds: entry.takerOdds, ts: entry.updatedAt }, 'set');
    this.cache.set(key, entry);
    this.emit('update', entry);
  }

  getSnapshot(): BestOddsEntry[] {
    return Array.from(this.cache.values());
  }
}

export const oddsCache = new OddsCache();
