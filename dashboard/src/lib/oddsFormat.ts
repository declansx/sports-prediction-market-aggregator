export type OddsFormat = 'decimal' | 'american' | 'percent';

const STORAGE_KEY = 'oddsFormat';
const VALID: readonly OddsFormat[] = ['decimal', 'american', 'percent'];

function readStored(): OddsFormat {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && (VALID as readonly string[]).includes(raw)) return raw as OddsFormat;
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall through
  }
  return 'decimal';
}

let current: OddsFormat = readStored();
const listeners = new Set<(f: OddsFormat) => void>();

export function getOddsFormat(): OddsFormat {
  return current;
}

export function setOddsFormat(format: OddsFormat): void {
  if (!(VALID as readonly string[]).includes(format)) return;
  if (format === current) return;
  current = format;
  try {
    localStorage.setItem(STORAGE_KEY, format);
  } catch {
    // ignore — in-memory value still updates
  }
  for (const fn of listeners) fn(current);
}

export function subscribeOddsFormat(fn: (f: OddsFormat) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function formatOdds(impliedOdds: number | null | undefined, format: OddsFormat): string {
  if (impliedOdds == null || !isFinite(impliedOdds) || impliedOdds <= 0 || impliedOdds > 1) {
    return '—';
  }
  if (format === 'percent') {
    return `${(impliedOdds * 100).toFixed(1)}%`;
  }
  const decimal = 1 / impliedOdds;
  if (format === 'american') {
    if (decimal <= 1.0001) return '—';
    if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`;
    return `-${Math.round(100 / (decimal - 1))}`;
  }
  return decimal.toFixed(2);
}
