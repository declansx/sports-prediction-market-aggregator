import type { Dispatch, SetStateAction } from 'react';
import { cn } from '../lib/utils';

interface LeagueTreeProps {
  sports: string[];
  /** Map<sport, Map<league, count>> */
  leaguesBySport: Map<string, Map<string, number>>;
  expandedSports: Set<string>;
  setExpandedSports: Dispatch<SetStateAction<Set<string>>>;
  selectedSport: string;
  selectedLeague: string;
  inPlayMode: boolean;
  livePlayCount: number;
  onSelectInPlay: () => void;
  onSelectLeague: (sport: string, league: string) => void;
}

/**
 * Presentational league/sport tree. The same component services the desktop sidebar
 * and the mobile <LeagueDrawer>. No data fetching of its own — every piece of state
 * (expanded sports, selection) lives in the parent and is passed down.
 */
export function LeagueTree({
  sports,
  leaguesBySport,
  expandedSports,
  setExpandedSports,
  selectedSport,
  selectedLeague,
  inPlayMode,
  livePlayCount,
  onSelectInPlay,
  onSelectLeague,
}: LeagueTreeProps) {
  return (
    <div className="p-2">
      <p className="px-2 py-2 font-mono text-[10px] font-semibold tracking-[0.2em] text-tm-tx-mut">
        LEAGUES
      </p>
      <button
        onClick={onSelectInPlay}
        className={cn(
          'w-full flex items-center justify-between px-2 py-1.5 text-[13px] transition-colors',
          inPlayMode
            ? 'bg-tm-bg-el text-tm-tx border-l-2 border-tm-neg pl-[6px]'
            : livePlayCount === 0
              ? 'text-tm-tx-mut hover:text-tm-tx-dim hover:bg-tm-bg-el/60'
              : 'text-tm-tx-dim hover:text-tm-tx hover:bg-tm-bg-el/60',
        )}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 rounded-full shrink-0',
              livePlayCount > 0 ? 'bg-tm-neg animate-pulse' : 'bg-tm-bd',
            )}
          />
          <span className="truncate">In-Play</span>
        </span>
        <span className="font-mono text-[10px] text-tm-tx-mut ml-2 shrink-0">{livePlayCount}</span>
      </button>
      {sports.map((sport) => {
        const isExpanded = expandedSports.has(sport);
        const leagues = Array.from(leaguesBySport.get(sport)?.entries() ?? []).sort(
          ([a], [b]) => a.localeCompare(b),
        );
        return (
          <div key={sport} className="mt-1">
            <button
              onClick={() =>
                setExpandedSports((prev) => {
                  const next = new Set(prev);
                  if (next.has(sport)) next.delete(sport);
                  else next.add(sport);
                  return next;
                })
              }
              className="w-full flex items-center gap-1.5 px-2 py-1.5 font-mono text-[10px] font-semibold tracking-[0.18em] text-tm-tx-dim hover:text-tm-tx uppercase"
            >
              <span className={cn('inline-block transition-transform', isExpanded && 'rotate-90')}>
                ▸
              </span>
              <span className="truncate text-left">{sport}</span>
            </button>
            {isExpanded &&
              leagues.map(([league, count]) => (
                <button
                  key={league}
                  onClick={() => onSelectLeague(sport, league)}
                  className={cn(
                    'w-full flex items-center justify-between px-2 py-1.5 pl-6 text-[13px] transition-colors',
                    !inPlayMode && selectedLeague === league && selectedSport === sport
                      ? 'bg-tm-bg-el text-tm-tx border-l-2 border-tm-sx pl-[22px]'
                      : 'text-tm-tx-dim hover:text-tm-tx hover:bg-tm-bg-el/60',
                  )}
                >
                  <span className="truncate text-left">{league}</span>
                  <span className="font-mono text-[10px] text-tm-tx-mut ml-2 shrink-0">{count}</span>
                </button>
              ))}
          </div>
        );
      })}
    </div>
  );
}
