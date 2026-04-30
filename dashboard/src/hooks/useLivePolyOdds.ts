import { useState, useEffect, useMemo } from 'react';
import { wsBus } from '../lib/wsBus';

// Maps CLOB tokenId → live post-fee taker odds (impliedOdds).
// Polymarket outcome externalId is the CLOB tokenId (see adapter convention).
export type LivePolyOddsMap = Map<string, number>;

export function livePolyOddsKey(externalId: string | undefined): string | null {
  if (!externalId) return null;
  return externalId;
}

// Hook: subscribes to the given tokenIds for the lifetime of the caller.
// Caller should pass a stable/memoised array — we defensively stringify-compare.
export function useLivePolyOdds(tokenIds: string[]): LivePolyOddsMap {
  const stableKey = useMemo(() => {
    const deduped = Array.from(new Set(tokenIds.filter((id): id is string => !!id)));
    deduped.sort();
    return deduped.join(',');
  }, [tokenIds]);

  const [oddsMap, setOddsMap] = useState<LivePolyOddsMap>(new Map());

  useEffect(() => {
    const ids = stableKey ? stableKey.split(',') : [];
    if (ids.length === 0) {
      setOddsMap((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }

    const wantedSet = new Set(ids);

    const offListener = wsBus.onPolyOdds((msg) => {
      if (msg.type === 'polyOddsSnapshot') {
        setOddsMap((prev) => {
          let next: LivePolyOddsMap | null = null;
          for (const e of msg.data) {
            if (!wantedSet.has(e.tokenId)) continue;
            if (prev.get(e.tokenId) === e.takerOdds) continue;
            if (!next) next = new Map(prev);
            next.set(e.tokenId, e.takerOdds);
          }
          return next ?? prev;
        });
      } else {
        if (!wantedSet.has(msg.tokenId)) return;
        setOddsMap((prev) => {
          if (prev.get(msg.tokenId) === msg.takerOdds) return prev;
          const next = new Map(prev);
          next.set(msg.tokenId, msg.takerOdds);
          return next;
        });
      }
    });

    wsBus.subscribePolyOdds(ids);

    return () => {
      wsBus.unsubscribePolyOdds(ids);
      offListener();
    };
  }, [stableKey]);

  return oddsMap;
}
