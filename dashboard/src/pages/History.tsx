import { useState, useEffect } from 'react';
import { getTrades, getBalances, type Trade, type BalanceSummary } from '../lib/api';
import { cn } from '../lib/utils';
import { formatOdds } from '../lib/oddsFormat';
import { useOddsFormat } from '../hooks/useOddsFormat';
import { VenueLogo } from '../components/VenueLogo';

function formatUsd(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BalanceCard({
  label,
  amount,
  accent,
}: {
  label: string;
  amount: number | null;
  accent: string;
}) {
  return (
    <div className="flex-1 rounded-sm border border-tm-bd bg-tm-bg-el px-3 py-2.5">
      <div className={cn('font-mono text-[9px] font-semibold tracking-[0.2em]', accent)}>
        {label}
      </div>
      <div className="mt-1 font-mono text-[18px] font-semibold text-tm-tx">
        {amount == null ? (
          <span className="text-tm-tx-mut">UNAVAILABLE</span>
        ) : (
          <>
            <span className="text-tm-tx-dim">$</span>
            {formatUsd(amount)}
          </>
        )}
      </div>
    </div>
  );
}

const POLYGONSCAN = 'https://polygonscan.com/tx/';
const GRID_COLS = '110px 1.4fr 1fr 44px 48px 60px 56px 72px 72px';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

function statusColor(status: string): string {
  if (status === 'filled') return 'text-tm-pos';
  if (status === 'failed') return 'text-tm-neg';
  return 'text-tm-warn';
}

function TradeRow({ t }: { t: Trade }) {
  const [oddsFmt] = useOddsFormat();
  const isSx = t.platform === 'sx';
  const size = t.executedSize != null ? t.executedSize : t.requestedSize;
  const statusLabel = t.status.toUpperCase();

  return (
    <div
      className="grid items-center border-b border-tm-bd px-2.5 py-2.5"
      style={{ gridTemplateColumns: GRID_COLS, columnGap: 8 }}
    >
      <span className="font-mono text-[10px] text-tm-tx-dim">{formatDate(t.createdAt)}</span>
      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-tm-tx">
        {t.marketName}
      </span>
      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-tm-tx-dim">
        {t.outcomeLabel}
      </span>
      <span className="flex items-center">
        <VenueLogo platform={isSx ? 'sx' : 'polymarket'} size={18} />
      </span>
      <span
        className={cn(
          'font-mono text-[10px] font-semibold',
          t.side === 'buy' ? 'text-tm-sx' : 'text-tm-tx-dim',
        )}
      >
        {t.side.toUpperCase()}
      </span>
      <span className="text-right font-mono text-[12px] font-semibold text-tm-tx">
        {size.toFixed(2)}
      </span>
      <span className="text-right font-mono text-[12px] font-semibold text-tm-tx">
        {formatOdds(t.fillOdds, oddsFmt)}
      </span>
      <span
        className={cn('font-mono text-[10px] font-semibold tracking-wider', statusColor(t.status))}
        title={t.failureReason ?? undefined}
      >
        ● {statusLabel}
      </span>
      {t.txHash ? (
        <a
          href={`${POLYGONSCAN}${t.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] text-tm-poly hover:underline"
        >
          {t.txHash.slice(0, 6)}…↗
        </a>
      ) : (
        <span className="font-mono text-[10px] text-tm-tx-mut">—</span>
      )}
    </div>
  );
}

export function History() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<BalanceSummary | null>(null);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    getTrades(page, limit)
      .then((res) => {
        setTrades(res.trades);
        setTotal(res.total);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load trades'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    getBalances()
      .then(setBalances)
      .catch(() => setBalances({ polymarket: null, sx: null }));
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex h-full min-h-0 flex-col bg-tm-bg">
      <div className="h-10 shrink-0 flex items-center gap-4 px-4 bg-tm-bg border-b border-tm-bd">
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-tm-tx-dim">
          TRADE HISTORY
        </span>
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-tm-bg-el border border-tm-bd text-tm-tx-dim">
          {total} TRADE{total !== 1 ? 'S' : ''}
        </span>

        <div className="ml-auto flex items-center gap-2 font-mono text-[10px] tracking-wider text-tm-tx-mut">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
            className="px-2 py-1 rounded-sm border border-tm-bd bg-transparent hover:bg-tm-bg-el hover:text-tm-tx disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-tm-tx-mut"
          >
            ‹ PREV
          </button>
          <span className="px-1 text-tm-tx-dim">
            {page}/{totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="px-2 py-1 rounded-sm border border-tm-bd bg-transparent hover:bg-tm-bg-el hover:text-tm-tx disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-tm-tx-mut"
          >
            NEXT ›
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div className="mb-4 flex gap-3">
          <BalanceCard
            label="POLYMARKET BALANCE"
            amount={balances?.polymarket ?? null}
            accent="text-tm-poly"
          />
          <BalanceCard
            label="SX BET BALANCE"
            amount={balances?.sx ?? null}
            accent="text-tm-sx"
          />
        </div>

        {error && (
          <div className="mb-3 rounded-sm border border-tm-neg/30 bg-tm-neg/10 px-3 py-2 font-mono text-[11px] text-tm-neg">
            {error}
          </div>
        )}

        <div
          className="grid items-center border-b border-tm-bd-st px-2.5 py-2 font-mono text-[9px] font-semibold tracking-[0.2em] text-tm-tx-mut"
          style={{ gridTemplateColumns: GRID_COLS, columnGap: 8 }}
        >
          <span>DATE</span>
          <span>MARKET</span>
          <span>OUTCOME</span>
          <span>SRC</span>
          <span>SIDE</span>
          <span className="text-right">SIZE</span>
          <span className="text-right">FILL</span>
          <span>STATUS</span>
          <span>TX</span>
        </div>

        {!loading && !error && trades.length === 0 && (
          <div className="px-2.5 py-8 text-center font-mono text-[11px] text-tm-tx-mut">
            NO TRADES YET
          </div>
        )}

        {trades.map((t) => (
          <TradeRow key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}
