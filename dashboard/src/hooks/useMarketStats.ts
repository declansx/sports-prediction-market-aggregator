import { useState, useEffect, useRef } from 'react';
import { getMarketStats, type MarketStatsResponse } from '../lib/api';

// Stats are 24h aggregates computed server-side from historical trades —
// they can't be derived from the current market list. They also don't move
// meaningfully on second-by-second timescales. Poll at the same slow cadence
// as the markets safety-net resync; if a future change pushes these over WS,
// drop this hook's polling entirely.
const POLL_INTERVAL_MS = 10 * 60_000;

export function useMarketStats() {
  const [data, setData] = useState<MarketStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetch() {
    try {
      const result = await getMarketStats();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('unknown error'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch();
    timerRef.current = setInterval(fetch, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { data, loading, error };
}
