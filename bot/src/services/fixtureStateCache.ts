import { EventEmitter } from 'events';

// SX Bet fixture status codes
export const FIXTURE_STATUS = {
  NOT_STARTED: 1,
  IN_PROGRESS: 2,
  FINISHED: 3,
  CANCELLED: 4,
  POSTPONED: 5,
  INTERRUPTED: 6,
  ABANDONED: 7,
  COVERAGE_LOST: 8,
  ABOUT_TO_START: 9,
} as const;

// Statuses that cause the game to be removed from the UI
const TERMINAL_STATUSES = new Set<number>([
  FIXTURE_STATUS.FINISHED,
  FIXTURE_STATUS.CANCELLED,
  FIXTURE_STATUS.ABANDONED,
]);

export interface FixturePeriod {
  label: string;
  isFinished: boolean;
  teamOneScore: string;
  teamTwoScore: string;
}

export interface FixtureState {
  sxEventId: string;
  status: number;
  teamOneScore: number;
  teamTwoScore: number;
  currentPeriod: string;
  periodTime: string;
  periods: FixturePeriod[];
  updatedAt: number;
}

export function isTerminalStatus(status: number): boolean {
  return TERMINAL_STATUSES.has(status);
}

export class FixtureStateCache extends EventEmitter {
  private entries = new Map<string, FixtureState>();
  private finalized = new Set<string>();

  set(entry: FixtureState): void {
    const existing = this.entries.get(entry.sxEventId);
    if (existing && existing.updatedAt > entry.updatedAt) return;

    // Merge: preserve any non-empty fields from existing when the incoming frame
    // has empty/default placeholders. This lets a status-only update coexist
    // with score data (and vice versa) without one clobbering the other.
    let merged: FixtureState = entry;
    if (existing) {
      merged = {
        ...entry,
        currentPeriod: entry.currentPeriod?.trim()
          ? entry.currentPeriod
          : existing.currentPeriod,
        periodTime:
          entry.periodTime && entry.periodTime !== '-1'
            ? entry.periodTime
            : existing.periodTime,
        periods: entry.periods.length > 0 ? entry.periods : existing.periods,
        teamOneScore:
          entry.teamOneScore === 0 && existing.teamOneScore > 0
            ? existing.teamOneScore
            : entry.teamOneScore,
        teamTwoScore:
          entry.teamTwoScore === 0 && existing.teamTwoScore > 0
            ? existing.teamTwoScore
            : entry.teamTwoScore,
        updatedAt: Math.max(existing.updatedAt, entry.updatedAt),
      };
    }

    this.entries.set(entry.sxEventId, merged);
    this.emit('update', merged);
    if (isTerminalStatus(merged.status) && !this.finalized.has(entry.sxEventId)) {
      this.finalized.add(entry.sxEventId);
      this.emit('finalize', merged);
    }
  }

  get(sxEventId: string): FixtureState | undefined {
    return this.entries.get(sxEventId);
  }

  has(sxEventId: string): boolean {
    return this.entries.has(sxEventId);
  }

  delete(sxEventId: string): void {
    this.entries.delete(sxEventId);
    this.finalized.delete(sxEventId);
  }

  getSnapshot(): FixtureState[] {
    return Array.from(this.entries.values());
  }

  getInPlay(): FixtureState[] {
    return Array.from(this.entries.values()).filter(
      (e) => e.status === FIXTURE_STATUS.IN_PROGRESS,
    );
  }
}

export const fixtureStateCache = new FixtureStateCache();
