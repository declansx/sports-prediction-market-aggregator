import { type FixtureState } from '../lib/wsBus';

interface LiveMatchHeaderProps {
  state: FixtureState;
}

// SX Bet emits `periodTime` as either:
//   - a whole-second counter (e.g. "4948" = 82:28 elapsed) — soccer, basketball, hockey
//   - already-formatted "MM:SS"
//   - "-1" when no clock is applicable (baseball, tennis)
function formatClock(periodTime: string): string | null {
  if (!periodTime || periodTime === '-1') return null;
  if (periodTime.includes(':')) return periodTime;
  const n = Number(periodTime);
  if (!Number.isFinite(n) || n < 0) return null;
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function LiveMatchHeader({ state }: LiveMatchHeaderProps) {
  const clock = formatClock(state.periodTime);
  const period = state.currentPeriod?.trim();
  const score = `${state.teamOneScore}-${state.teamTwoScore}`;
  return (
    <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px] tracking-wider leading-none">
      <span className="flex items-center gap-1">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-tm-neg animate-pulse" />
        <span className="font-semibold text-tm-neg">LIVE</span>
      </span>
      {period && (
        <>
          <span className="text-tm-bd-st">·</span>
          <span className="text-tm-tx-dim normal-case">{period}</span>
        </>
      )}
      {clock && (
        <>
          <span className="text-tm-bd-st">·</span>
          <span className="tabular-nums text-tm-tx-dim">{clock}</span>
        </>
      )}
      <span className="text-tm-bd-st">·</span>
      <span className="tabular-nums font-semibold text-tm-tx">{score}</span>
    </div>
  );
}
