import { useState, useEffect } from 'react';
import { getConfig, putConfig, type ConfigRow } from '../lib/api';
import { toast } from '../components/ui/use-toast';
import { cn } from '../lib/utils';
import { useOddsFormat } from '../hooks/useOddsFormat';
import { type OddsFormat } from '../lib/oddsFormat';

const ODDS_FORMAT_OPTIONS: { value: OddsFormat; label: string }[] = [
  { value: 'decimal', label: 'DECIMAL' },
  { value: 'american', label: 'AMERICAN' },
  { value: 'percent', label: 'PERCENT' },
];

function OddsFormatToggle() {
  const [format, setFormat] = useOddsFormat();
  return (
    <div
      className="mb-4 rounded-[var(--tm-rad)] border border-tm-bd bg-tm-bg-el px-3.5 py-3"
    >
      <div className="font-mono text-[11px] font-semibold text-tm-tx">odds format</div>
      <div className="mt-1 font-mono text-[10px] leading-[1.5] text-tm-tx-mut">
        How odds are displayed throughout the dashboard. Decimal (2.06), American (+106 / -120), or implied probability (48.5%). Choice is stored locally in this browser only — does not affect bot behaviour.
      </div>
      <div className="mt-2.5 inline-flex rounded-[var(--tm-rad)] border border-tm-bd bg-tm-bg-sunk overflow-hidden">
        {ODDS_FORMAT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFormat(opt.value)}
            className={cn(
              'px-3 py-1.5 font-mono text-[10px] font-bold tracking-wider transition-colors',
              format === opt.value
                ? 'bg-tm-sx text-black'
                : 'text-tm-tx-dim hover:text-tm-tx hover:bg-tm-bg-el',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const KEY_DESCRIPTIONS: Record<string, string> = {
  maxTradeSize:
    'Hard ceiling on a single trade. When a trade is requested, the router checks the requested size against this value before doing anything else — if it exceeds the cap the plan is rejected with size_exceeds_max and no order-book walk, allocation, or on-chain call happens.',
  slippageTolerance:
    'Max fractional drift between the best odds on any book and the volume-weighted odds of the actual fill. After the router sorts all SX + Polymarket levels and walks them to fill the requested size, it compares the blended fill price to the single best level. If the drift exceeds this tolerance, the plan is aborted with slippage_exceeded, a failed Trade row is written, and Telegram is alerted — before any order is submitted.',
  pollingInterval:
    'How often (ms) the market-sync loop refreshes quotes from SX Bet and Polymarket. Shorter interval = fresher odds but more API load.',
  orderBookLevels:
    'Number of top order-book price levels streamed per side for the live SX Bet book in the bet slip / trade panel. Higher = more depth visible but more data sent over the WS. Range 3–25.',
};

export function Settings() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConfig()
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load config'))
      .finally(() => setLoading(false));
  }, []);

  function getValue(key: string) {
    return key in edited ? edited[key] : (rows.find((r) => r.key === key)?.value ?? '');
  }

  async function handleSave(key: string) {
    const value = getValue(key);
    setSaving(key);
    try {
      await putConfig(key, value);
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, value } : r)));
      setEdited((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast({ title: 'Saved', description: `${key} updated`, variant: 'success' });
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-tm-bg">
      <div className="h-10 shrink-0 flex items-center gap-4 px-4 bg-tm-bg border-b border-tm-bd">
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-tm-tx-dim">
          CONFIG
        </span>
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-tm-bg-el border border-tm-bd text-tm-tx-dim">
          {rows.length} KEY{rows.length !== 1 ? 'S' : ''}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-5">
        <div className="max-w-[560px]">
          <div className="mb-3 font-mono text-[10px] font-semibold tracking-[0.2em] text-tm-tx-dim">
            DISPLAY
          </div>
          <OddsFormatToggle />

          {error && (
            <div className="mb-3 rounded-sm border border-tm-neg/30 bg-tm-neg/10 px-3 py-2 font-mono text-[11px] text-tm-neg">
              {error}
            </div>
          )}

          {loading && (
            <div className="font-mono text-[11px] text-tm-tx-mut tracking-wider">LOADING…</div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="font-mono text-[11px] text-tm-tx-mut tracking-wider">
              NO CONFIG VALUES FOUND
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="mb-3 font-mono text-[10px] font-semibold tracking-[0.2em] text-tm-tx-dim">
                BOT PARAMETERS
              </div>

              {rows.map((row) => {
                const isDirty = row.key in edited && edited[row.key] !== row.value;
                const isSaving = saving === row.key;
                return (
                  <div
                    key={row.key}
                    className="mb-1.5 grid items-center rounded-[var(--tm-rad)] border border-tm-bd bg-tm-bg-el px-3.5 py-3.5"
                    style={{ gridTemplateColumns: '1fr 180px 60px', columnGap: 12 }}
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] font-semibold text-tm-tx break-all">
                        {row.key}
                      </div>
                      {KEY_DESCRIPTIONS[row.key] && (
                        <div className="mt-1 pr-3 font-mono text-[10px] leading-[1.5] text-tm-tx-mut">
                          {KEY_DESCRIPTIONS[row.key]}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 rounded-[var(--tm-rad)] border border-tm-bd bg-tm-bg-sunk px-2.5 py-1.5 focus-within:border-tm-sx">
                      <input
                        value={getValue(row.key)}
                        onChange={(e) =>
                          setEdited((prev) => ({ ...prev, [row.key]: e.target.value }))
                        }
                        className="min-w-0 flex-1 bg-transparent font-mono text-[13px] font-semibold text-tm-tx outline-none"
                      />
                    </div>

                    <button
                      onClick={() => handleSave(row.key)}
                      disabled={!isDirty || isSaving}
                      className={cn(
                        'rounded-[var(--tm-rad)] py-1.5 font-mono text-[10px] font-bold tracking-wider transition-colors',
                        isDirty && !isSaving
                          ? 'bg-tm-sx text-black hover:bg-tm-sx/90'
                          : 'bg-tm-bg-sunk text-tm-tx-mut cursor-not-allowed',
                      )}
                    >
                      {isSaving ? '…' : 'SAVE'}
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
