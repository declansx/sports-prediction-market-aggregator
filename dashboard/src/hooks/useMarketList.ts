import { useEffect, useRef, useState } from 'react';
import { wsBus } from '../lib/wsBus';
import { getMarkets, type Market } from '../lib/api';

// 3 s WS-snapshot timeout. If the bot doesn't push a `marketsSnapshot` over
// the WS within this window, fall back to GET /api/markets so the page is
// never stuck on a blank loading state.
const WS_SNAPSHOT_FALLBACK_MS = 3_000;

// Public read-only build has no bot/relay — it polls the edge-cached
// GET /api/markets serverless function instead of receiving WS deltas. The
// edge CDN holds the response ~60s, so this cadence costs ~one upstream fetch
// per minute no matter how many visitors are polling.
const PUBLIC_MODE = import.meta.env.VITE_PUBLIC_MODE === 'true';
const PUBLIC_POLL_MS = 60_000;

/**
 * Source-of-truth hook for the dashboard's market list.
 *
 * Replaces the previous REST-poll + delta merge pattern. The bot now pushes
 * a `marketsSnapshot` over the dashboard ↔ bot WS at connect time, then
 * `marketUpsert` / `marketRemoved` deltas as things change. This hook
 * simply maintains the local mirror.
 *
 * Falls back to a single REST fetch if the WS snapshot doesn't arrive
 * within {@link WS_SNAPSHOT_FALLBACK_MS}, so a transient WS issue doesn't
 * leave the page blank.
 */
export function useMarketList(): { markets: Market[]; loading: boolean } {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const cache = useRef(new Map<string, Market>());
  const snapshotReceived = useRef(false);

  useEffect(() => {
    // Public mode: no WS relay exists. Poll the edge-cached REST endpoint on
    // an interval and replace the list wholesale each time.
    if (PUBLIC_MODE) {
      let cancelled = false;
      const load = () => {
        getMarkets()
          .then((data) => {
            if (cancelled) return;
            setMarkets(data);
            setLoading(false);
          })
          .catch(() => {
            // Keep the last good list on a transient failure; next tick retries.
          });
      };
      load();
      const id = setInterval(load, PUBLIC_POLL_MS);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }

    const off = wsBus.onMarketLifecycle((msg) => {
      if (msg.type === 'marketsSnapshot') {
        cache.current = new Map(msg.data.map((m) => [m.id, m]));
        snapshotReceived.current = true;
        setMarkets(Array.from(cache.current.values()));
        setLoading(false);
      } else if (msg.type === 'marketUpsert') {
        cache.current.set(msg.data.id, msg.data);
        setMarkets(Array.from(cache.current.values()));
      } else if (msg.type === 'marketRemoved') {
        cache.current.delete(msg.id);
        setMarkets(Array.from(cache.current.values()));
      }
    });

    // Fallback: if no WS snapshot in 3s, fetch via REST. Only fires once.
    const fallback = setTimeout(() => {
      if (snapshotReceived.current) return;
      getMarkets()
        .then((data) => {
          if (snapshotReceived.current) return; // WS won the race
          cache.current = new Map(data.map((m) => [m.id, m]));
          setMarkets(Array.from(cache.current.values()));
          setLoading(false);
        })
        .catch(() => {
          // Best-effort fallback. If REST fails too, leave loading=true so
          // the next WS snapshot (whenever it arrives) can populate.
        });
    }, WS_SNAPSHOT_FALLBACK_MS);

    return () => {
      clearTimeout(fallback);
      off();
    };
  }, []);

  return { markets, loading };
}
