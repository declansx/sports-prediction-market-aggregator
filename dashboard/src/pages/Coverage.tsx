import { useState } from 'react';
import { useMarketStats } from '../hooks/useMarketStats';
import type { BestOddsCount, WinnerEdgeDepth } from '../lib/api';
import { cn } from '../lib/utils';
import { VenueLogo } from '../components/VenueLogo';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  if (n >= 100) return `$${Math.round(n)}`;
  return `$${n.toFixed(n < 10 ? 2 : 0)}`;
}

type Winner = 'sx' | 'poly' | null;

function leader(counts: BestOddsCount): Winner {
  if (counts.total === 0) return null;
  if (counts.sx === counts.poly) return 'sx';
  return counts.sx > counts.poly ? 'sx' : 'poly';
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({
  scope,
  scopeSub,
  counts,
  edge,
  zoomed,
}: {
  scope: string;
  scopeSub: string;
  counts: BestOddsCount;
  edge: WinnerEdgeDepth | null;
  zoomed: boolean;
}) {
  const sz = zoomed
    ? {
        scope: 'text-[22px]',
        scopeSub: 'text-[18px] mt-2',
        noData: 'text-[20px]',
        maxW: 'max-w-[380px]',
        pct: 'text-[72px]',
        betterRow: 'gap-2 mt-3 text-[18px]',
        betterLogo: 24,
        countsRow: 'gap-6 text-[20px]',
        countsItem: 'gap-2',
        countsLogo: 24,
        liq: 'text-[17px] min-h-[44px]',
      }
    : {
        scope: 'text-[17px]',
        scopeSub: 'text-[14px] mt-1.5',
        noData: 'text-[16px]',
        maxW: 'max-w-[320px]',
        pct: 'text-[56px]',
        betterRow: 'gap-1.5 mt-2.5 text-[14px]',
        betterLogo: 18,
        countsRow: 'gap-5 text-[16px]',
        countsItem: 'gap-1.5',
        countsLogo: 18,
        liq: 'text-[14px] min-h-[36px]',
      };
  const { sx, poly, total } = counts;
  const sxPct = total > 0 ? (sx / total) * 100 : 0;
  const polyPct = total > 0 ? (poly / total) * 100 : 0;
  const sxRound = Math.round(sxPct);
  const polyRound = 100 - sxRound;
  const win = leader(counts);
  const winPct = win === 'sx' ? sxRound : polyRound;
  const winColor = win === 'sx' ? 'text-tm-sx' : win === 'poly' ? 'text-tm-poly' : 'text-tm-tx-mut';

  // Donut geometry, viewBox-based for responsive sizing
  const r = 42;
  const c = 2 * Math.PI * r;
  const sxLen = (c * sxPct) / 100;
  const polyLen = (c * polyPct) / 100;
  const gap = sxPct > 0 && polyPct > 0 ? 1.2 : 0;

  return (
    <div className="flex-1 min-w-0 flex flex-col items-center justify-between gap-4 py-2">
      <div className="text-center">
        <div className={cn('font-mono tracking-[0.14em] text-tm-tx font-semibold', sz.scope)}>{scope}</div>
        <div className={cn('font-mono text-tm-tx-mut tracking-wider', sz.scopeSub)}>{scopeSub}</div>
      </div>

      {total === 0 ? (
        <div className={cn('flex items-center justify-center font-mono text-tm-tx-mut min-h-[200px]', sz.noData)}>— no data</div>
      ) : (
        <div className={cn('relative w-full aspect-square', sz.maxW)}>
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              style={{ stroke: 'hsl(var(--tm-bd))' }}
              strokeWidth="11"
            />
            {sxPct > 0 && (
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="none"
                style={{ stroke: 'hsl(var(--tm-sx))' }}
                strokeWidth="11"
                strokeLinecap="butt"
                strokeDasharray={`${Math.max(0, sxLen - gap)} ${c}`}
              />
            )}
            {polyPct > 0 && (
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="none"
                style={{ stroke: 'hsl(var(--tm-poly))' }}
                strokeWidth="11"
                strokeLinecap="butt"
                strokeDasharray={`${Math.max(0, polyLen - gap)} ${c}`}
                strokeDashoffset={-sxLen}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
            <span className={cn('font-bold leading-none tabular-nums', sz.pct, winColor)}>
              {winPct}%
            </span>
            <span className={cn('flex items-center text-tm-tx-dim tracking-[0.18em]', sz.betterRow)}>
              <VenueLogo platform={win === 'sx' ? 'sx' : 'polymarket'} size={sz.betterLogo} />
              <span>BETTER</span>
            </span>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className={cn('flex items-center font-mono', sz.countsRow)}>
          <span className={cn('flex items-center', sz.countsItem)}>
            <VenueLogo platform="sx" size={sz.countsLogo} />
            <span className="text-tm-sx font-bold tabular-nums">{sx}</span>
            <span className="text-tm-tx-mut">· {sxRound}%</span>
          </span>
          <span className="text-tm-bd-st">·</span>
          <span className={cn('flex items-center', sz.countsItem)}>
            <VenueLogo platform="polymarket" size={sz.countsLogo} />
            <span className="text-tm-poly font-bold tabular-nums">{poly}</span>
            <span className="text-tm-tx-mut">· {polyRound}%</span>
          </span>
        </div>
      )}

      <div className={cn('font-mono text-center', sz.liq)}>
        {edge ? (
          <>
            <div>
              <span className={cn('font-bold', edge.venue === 'sx' ? 'text-tm-sx' : 'text-tm-poly')}>
                {fmtUSD(edge.avgSize)}
              </span>
              <span className="text-tm-tx-mut"> avg liquidity at better price</span>
            </div>
            <div className="text-tm-tx-mut mt-0.5">over {edge.sampleCount} winning outcomes</div>
          </>
        ) : (
          <span className="text-tm-tx-mut">{total > 0 ? 'no liquidity sample' : ''}</span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Coverage() {
  const { data, loading, error } = useMarketStats();
  const [zoomed, setZoomed] = useState(false);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-tm-tx-dim font-mono text-xs tracking-widest">
        LOADING…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="rounded-[var(--tm-rad)] border border-tm-neg/40 bg-tm-neg/10 px-4 py-3 font-mono text-xs text-tm-neg">
          {error?.message ?? 'Failed to load stats'}
        </div>
      </div>
    );
  }

  const headline = data.bestOddsMatched24h;
  const headlineWinner = leader(headline);
  const headlinePct =
    headline.total > 0
      ? Math.round(((headlineWinner === 'sx' ? headline.sx : headline.poly) / headline.total) * 100)
      : 0;
  const headlineColor = headlineWinner === 'sx' ? 'text-tm-sx' : 'text-tm-poly';
  const headlineEdge = data.edgeMatched24h;

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 shrink-0 flex items-center px-4 bg-tm-bg border-b border-tm-bd">
        <span className="font-mono text-[12px] font-semibold tracking-[0.2em] text-tm-tx-dim">COVERAGE · NEXT 24H</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-[1400px] mx-auto h-full flex flex-col gap-4">

          {/* Headline */}
          <section className="rounded-[var(--tm-rad)] border border-tm-bd bg-tm-bg-el px-5 py-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center shrink-0">
            <div className="flex flex-col gap-1">
              {headline.total === 0 ? (
                <span className="font-mono text-2xl text-tm-tx-mut">— no games on both platforms</span>
              ) : (
                <>
                  <div className="font-mono leading-none flex items-center gap-3">
                    <span className={cn('text-[44px] font-bold leading-none', headlineColor)}>{headlinePct}%</span>
                    <span className="text-[15px] tracking-[0.1em] text-tm-tx-dim flex items-center gap-1.5">
                      OUTCOMES PRICED BETTER ON
                      <VenueLogo platform={headlineWinner === 'sx' ? 'sx' : 'polymarket'} size={18} />
                    </span>
                  </div>
                  <div className="font-mono text-[15px] text-tm-tx-dim mt-2">
                    {headlineEdge && (
                      <>
                        <b className={headlineEdge.venue === 'sx' ? 'text-tm-sx' : 'text-tm-poly'}>
                          {fmtUSD(headlineEdge.avgSize)}
                        </b>
                        <span className="text-tm-tx-mut"> avg liquidity at better price</span>
                        <span className="text-tm-tx-mut"> · </span>
                      </>
                    )}
                    <span className="text-tm-tx-mut">across {headline.total} match-winner outcomes</span>
                  </div>
                </>
              )}
            </div>

            <span className="font-mono text-[13px] tracking-[0.2em] text-tm-tx-mut justify-self-start lg:justify-self-end whitespace-nowrap rounded-sm border border-tm-bd-st px-3 py-1.5">
              NEXT 24H
            </span>
          </section>

          {/* Donut charts */}
          <section className="flex-1 min-h-[420px] rounded-[var(--tm-rad)] border border-tm-bd bg-tm-bg-el px-5 py-4 flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[14px] tracking-[0.18em] text-tm-tx-mut">BEST ODDS · WHO PRICED HIGHER</span>
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-tm-bd-st text-tm-tx-mut text-[12px] font-bold cursor-help"
                  title="Per outcome on games listed on both platforms in the next 24h, which side offers the better price — higher decimal odds for the bettor (SX wins ties). Liquidity-at-better-price is the average dollar size on the winning venue's ladder priced strictly better than the other side's best, over the outcomes the winner won."
                >
                  ?
                </span>
              </div>
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                aria-pressed={zoomed}
                title={zoomed ? 'Reset to default size' : 'Enlarge text and logos for screenshots'}
                className={cn(
                  'font-mono text-[11px] tracking-[0.15em] px-2.5 py-1 rounded-sm border transition-colors',
                  zoomed
                    ? 'border-tm-tx-mut text-tm-tx bg-tm-bg'
                    : 'border-tm-bd-st text-tm-tx-mut hover:text-tm-tx hover:border-tm-tx-mut',
                )}
              >
                {zoomed ? 'ZOOM ON' : 'ZOOM'}
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch min-h-0 mt-3 divide-y md:divide-y-0 md:divide-x divide-tm-bd">
              <DonutChart
                scope="MATCH WINNER MARKETS"
                scopeSub={`ML, 1X2 · ${data.bestOddsMatched24h.total} outcomes`}
                counts={data.bestOddsMatched24h}
                edge={data.edgeMatched24h}
                zoomed={zoomed}
              />
              <DonutChart
                scope="ALL MARKET TYPES"
                scopeSub={`spreads, totals, alts · ${data.bestOddsAllMatched24h.total} outcomes`}
                counts={data.bestOddsAllMatched24h}
                edge={data.edgeAllMatched24h}
                zoomed={zoomed}
              />
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

