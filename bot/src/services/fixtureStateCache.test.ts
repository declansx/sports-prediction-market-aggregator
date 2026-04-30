import { describe, it, expect, beforeEach } from 'vitest';
import { FixtureStateCache, FIXTURE_STATUS, isTerminalStatus, type FixtureState } from './fixtureStateCache';

function mkState(overrides: Partial<FixtureState> = {}): FixtureState {
  return {
    sxEventId: 'L1',
    status: FIXTURE_STATUS.IN_PROGRESS,
    teamOneScore: 0,
    teamTwoScore: 0,
    currentPeriod: '1st Half',
    periodTime: '10:00',
    periods: [],
    updatedAt: 100,
    ...overrides,
  };
}

describe('FixtureStateCache', () => {
  let cache: FixtureStateCache;

  beforeEach(() => {
    cache = new FixtureStateCache();
  });

  it('set + get round-trip', () => {
    cache.set(mkState());
    const out = cache.get('L1');
    expect(out).toBeDefined();
    expect(out!.status).toBe(FIXTURE_STATUS.IN_PROGRESS);
    expect(out!.currentPeriod).toBe('1st Half');
  });

  it('emits update on set', () => {
    const events: FixtureState[] = [];
    cache.on('update', (e: FixtureState) => events.push(e));
    cache.set(mkState());
    expect(events).toHaveLength(1);
    expect(events[0].sxEventId).toBe('L1');
  });

  it('drops out-of-order updates with older updatedAt', () => {
    cache.set(mkState({ teamOneScore: 1, updatedAt: 100 }));
    const events: FixtureState[] = [];
    cache.on('update', (e) => events.push(e));
    cache.set(mkState({ teamOneScore: 5, updatedAt: 50 }));
    expect(events).toHaveLength(0);
    expect(cache.get('L1')!.teamOneScore).toBe(1);
  });

  it('merges preserves non-empty fields when incoming frame has placeholders', () => {
    cache.set(mkState({ currentPeriod: '2nd Half', periodTime: '67:12', teamOneScore: 2, updatedAt: 100 }));
    // status-only update (empty period, 0 scores) should NOT clobber existing data
    cache.set(mkState({ currentPeriod: '', periodTime: '-1', teamOneScore: 0, teamTwoScore: 0, updatedAt: 200 }));
    const state = cache.get('L1')!;
    expect(state.currentPeriod).toBe('2nd Half');
    expect(state.periodTime).toBe('67:12');
    expect(state.teamOneScore).toBe(2);
  });

  it('finalize fires exactly once per sxEventId on status transition into 3/4/7', () => {
    const events: FixtureState[] = [];
    cache.on('finalize', (e) => events.push(e));

    cache.set(mkState({ updatedAt: 100, status: FIXTURE_STATUS.IN_PROGRESS }));
    expect(events).toHaveLength(0);

    cache.set(mkState({ updatedAt: 200, status: FIXTURE_STATUS.FINISHED }));
    expect(events).toHaveLength(1);

    // Repeated finalized frames do not re-emit
    cache.set(mkState({ updatedAt: 300, status: FIXTURE_STATUS.FINISHED, teamOneScore: 3 }));
    expect(events).toHaveLength(1);
  });

  it.each([
    FIXTURE_STATUS.FINISHED,
    FIXTURE_STATUS.CANCELLED,
    FIXTURE_STATUS.ABANDONED,
  ])('finalize fires for terminal status %i', (status) => {
    const events: FixtureState[] = [];
    cache.on('finalize', (e) => events.push(e));
    cache.set(mkState({ status, updatedAt: 100 }));
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe(status);
  });

  it.each([
    FIXTURE_STATUS.NOT_STARTED,
    FIXTURE_STATUS.IN_PROGRESS,
    FIXTURE_STATUS.POSTPONED,
    FIXTURE_STATUS.INTERRUPTED,
    FIXTURE_STATUS.COVERAGE_LOST,
    FIXTURE_STATUS.ABOUT_TO_START,
  ])('finalize does NOT fire for non-terminal status %i', (status) => {
    const events: FixtureState[] = [];
    cache.on('finalize', (e) => events.push(e));
    cache.set(mkState({ status, updatedAt: 100 }));
    expect(events).toHaveLength(0);
  });

  it('isTerminalStatus helper', () => {
    expect(isTerminalStatus(FIXTURE_STATUS.FINISHED)).toBe(true);
    expect(isTerminalStatus(FIXTURE_STATUS.CANCELLED)).toBe(true);
    expect(isTerminalStatus(FIXTURE_STATUS.ABANDONED)).toBe(true);
    expect(isTerminalStatus(FIXTURE_STATUS.IN_PROGRESS)).toBe(false);
    expect(isTerminalStatus(FIXTURE_STATUS.POSTPONED)).toBe(false);
  });

  it('getSnapshot returns all entries', () => {
    cache.set(mkState({ sxEventId: 'L1', updatedAt: 100 }));
    cache.set(mkState({ sxEventId: 'L2', updatedAt: 200 }));
    const snap = cache.getSnapshot();
    expect(snap).toHaveLength(2);
  });

  it('getInPlay filters to status=2 only', () => {
    cache.set(mkState({ sxEventId: 'L1', status: FIXTURE_STATUS.IN_PROGRESS, updatedAt: 100 }));
    cache.set(mkState({ sxEventId: 'L2', status: FIXTURE_STATUS.NOT_STARTED, updatedAt: 100 }));
    cache.set(mkState({ sxEventId: 'L3', status: FIXTURE_STATUS.FINISHED, updatedAt: 100 }));
    const live = cache.getInPlay();
    expect(live).toHaveLength(1);
    expect(live[0].sxEventId).toBe('L1');
  });
});
