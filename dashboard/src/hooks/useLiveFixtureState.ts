import { useEffect, useState } from 'react';
import { wsBus, type FixtureState, type FixtureMessage } from '../lib/wsBus';

export type FixtureStateMap = Map<string, FixtureState>;

export interface LiveFixtures {
  states: FixtureStateMap;
  removed: Set<string>;
}

export function useLiveFixtureState(): LiveFixtures {
  const [live, setLive] = useState<LiveFixtures>(() => ({
    states: new Map(),
    removed: new Set(),
  }));

  useEffect(() => {
    const unsub = wsBus.onFixture((msg: FixtureMessage) => {
      setLive((prev) => {
        if (msg.type === 'fixtureSnapshot') {
          const states = new Map<string, FixtureState>();
          for (const s of msg.data) states.set(s.sxEventId, s);
          return { states, removed: prev.removed };
        }
        if (msg.type === 'fixtureUpdate') {
          const existing = prev.states.get(msg.data.sxEventId);
          if (existing && existing.updatedAt >= msg.data.updatedAt) return prev;
          const states = new Map(prev.states);
          states.set(msg.data.sxEventId, msg.data);
          return { states, removed: prev.removed };
        }
        // fixtureRemove
        const states = new Map(prev.states);
        states.delete(msg.sxEventId);
        const removed = new Set(prev.removed);
        removed.add(msg.sxEventId);
        return { states, removed };
      });
    });
    return unsub;
  }, []);

  return live;
}
