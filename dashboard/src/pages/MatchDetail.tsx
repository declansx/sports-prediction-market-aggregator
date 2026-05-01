import {
  categorizeOutcomes,
  get1X2,
  getSpreadMLTotal,
  isAmericanSport,
  getBestOdds,
  pairOutcomes,
  formatDate,
  type MatchGroup,
  type OutcomeRow,
  type BetSlipSelection,
} from '../lib/marketUtils';
import { cn } from '../lib/utils';
import { formatOdds } from '../lib/oddsFormat';
import { useOddsFormat } from '../hooks/useOddsFormat';
import { LiveMatchHeader } from '../components/LiveMatchHeader';
import { VenueLogo } from '../components/VenueLogo';
import { OddsLegend } from '../components/OddsLegend';
import { type FixtureState } from '../lib/wsBus';

const IN_PLAY_STATUS = 2;

type Platform = 'sx' | 'polymarket';

function venueChip(platform: Platform) {
  return platform === 'sx'
    ? { text: 'text-tm-sx',   bg: 'bg-tm-sx/15',   border: 'border-tm-sx' }
    : { text: 'text-tm-poly', bg: 'bg-tm-poly/15', border: 'border-tm-poly' };
}

// ─── Best-odds card (1X2 YES/NOT, moneyline) ──────────────────────────────────

interface BestCardProps {
  outcome: OutcomeRow;
  matchName: string;
  columnLabel?: string;
  selection: BetSlipSelection | null;
  onOddsClick: (outcomeId: string, label: string, matchName: string) => void;
}

function BestCard({ outcome, matchName, columnLabel, selection, onOddsClick }: BestCardProps) {
  const [format] = useOddsFormat();
  const best = getBestOdds(outcome);
  const decimal = best && best.impliedOdds > 0 ? formatOdds(best.impliedOdds, format) : null;
  const platform: Platform = best?.platform === 'polymarket' ? 'polymarket' : 'sx';
  const accentBorder = decimal ? (platform === 'sx' ? 'border-l-tm-sx' : 'border-l-tm-poly') : 'border-l-tm-bd';
  const isSelected = selection?.outcomeId === outcome.outcomeId;

  return (
    <button
      onClick={() => decimal && onOddsClick(outcome.outcomeId, outcome.label, matchName)}
      disabled={!decimal}
      className={cn(
        'w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-tm-bg-el border border-tm-bd border-l-2',
        accentBorder,
        'rounded-[var(--tm-rad)] text-left transition-all',
        decimal && 'hover:bg-tm-bg-el/80 hover:border-tm-bd-st cursor-pointer',
        isSelected && (platform === 'sx'
          ? 'ring-1 ring-tm-sx/50 bg-tm-sx/10'
          : 'ring-1 ring-tm-poly/50 bg-tm-poly/10'),
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {columnLabel && (
          <span className="font-mono text-[9px] text-tm-tx-mut shrink-0">{columnLabel}</span>
        )}
        <span className="text-[12px] font-medium text-tm-tx truncate">{outcome.label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {decimal ? (
          <>
            <VenueLogo platform={platform} size={18} />
            <span className="font-mono text-[15px] font-semibold text-tm-tx tabular-nums w-[56px] text-right">{decimal}</span>
          </>
        ) : (
          <span className="font-mono text-[13px] text-tm-tx-mut tabular-nums w-[56px] text-right">—</span>
        )}
      </div>
    </button>
  );
}

// ─── Paired row (Totals / Handicap / Other) ───────────────────────────────────

interface PairedRowProps {
  left: OutcomeRow;
  right: OutcomeRow | null;
  matchName: string;
  selection: BetSlipSelection | null;
  onOddsClick: (outcomeId: string, label: string, matchName: string) => void;
}

function PairHalf({
  outcome,
  matchName,
  isMainStar,
  selection,
  onOddsClick,
}: {
  outcome: OutcomeRow;
  matchName: string;
  isMainStar: boolean;
  selection: BetSlipSelection | null;
  onOddsClick: (outcomeId: string, label: string, matchName: string) => void;
}) {
  const [format] = useOddsFormat();
  const best = getBestOdds(outcome);
  const decimal = best && best.impliedOdds > 0 ? formatOdds(best.impliedOdds, format) : null;
  const platform: Platform = best?.platform === 'polymarket' ? 'polymarket' : 'sx';
  const isSelected = selection?.outcomeId === outcome.outcomeId;

  return (
    <button
      onClick={() => decimal && onOddsClick(outcome.outcomeId, outcome.label, matchName)}
      disabled={!decimal}
      className={cn(
        'w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-tm-bg-el border border-tm-bd rounded-[var(--tm-rad)] text-left transition-all',
        decimal && 'hover:border-tm-bd-st cursor-pointer',
        isSelected && (platform === 'sx'
          ? 'ring-1 ring-tm-sx/50 bg-tm-sx/10'
          : 'ring-1 ring-tm-poly/50 bg-tm-poly/10'),
      )}
    >
      <span className="text-[14px] font-medium text-tm-tx truncate flex items-center gap-1.5">
        {isMainStar && <span className="text-tm-warn shrink-0">★</span>}
        {outcome.label}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {decimal ? (
          <>
            <VenueLogo platform={platform} size={18} />
            <span className="font-mono text-[15px] font-semibold text-tm-tx tabular-nums w-[56px] text-right">{decimal}</span>
          </>
        ) : (
          <span className="font-mono text-[14px] text-tm-tx-mut tabular-nums w-[56px] text-right">—</span>
        )}
      </div>
    </button>
  );
}

function PairedRow({ left, right, matchName, selection, onOddsClick }: PairedRowProps) {
  const isMain = left.mainLine || (right?.mainLine ?? false);
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2 rounded-[var(--tm-rad)]',
        isMain ? 'bg-tm-warn/5 p-1' : 'p-0',
      )}
    >
      <PairHalf
        outcome={left}
        matchName={matchName}
        isMainStar={isMain}
        selection={selection}
        onOddsClick={onOddsClick}
      />
      {right ? (
        <PairHalf
          outcome={right}
          matchName={matchName}
          isMainStar={false}
          selection={selection}
          onOddsClick={onOddsClick}
        />
      ) : (
        <div />
      )}
    </div>
  );
}

// ─── Section title strip ──────────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="font-mono text-[10px] font-semibold tracking-[0.2em] text-tm-tx-dim pb-1.5 mb-2.5 border-b border-tm-bd">
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Match Detail page ────────────────────────────────────────────────────────

interface MatchDetailProps {
  group: MatchGroup;
  selection: BetSlipSelection | null;
  liveState?: FixtureState;
  onBack: () => void;
  onOddsClick: (outcomeId: string, label: string, matchName: string) => void;
}

export function MatchDetail({ group, selection, liveState, onBack, onOddsClick }: MatchDetailProps) {
  const isLive = !!liveState && liveState.status === IN_PLAY_STATUS;
  const { totals, handicaps, others } = categorizeOutcomes(group);
  const { home, draw, away, notHome, notDraw, notAway } = get1X2(group);
  const { mlHome, mlAway } = getSpreadMLTotal(group);
  const american = isAmericanSport(group);

  const parts = group.name.split(' vs ').map((s) => s.trim());
  const team1 = parts[0] ?? '';
  const team2 = parts[1] ?? '';

  const totalsPairs = pairOutcomes(totals);
  const handicapsPairs = pairOutcomes(handicaps);
  const othersFiltered = american ? others.filter((o) => o.betType !== '12') : others;
  const othersPairs = pairOutcomes(othersFiltered);

  return (
    <div className="flex flex-col h-full bg-tm-bg">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 shrink-0 flex items-center gap-3 px-4 min-h-10 py-1.5 bg-tm-bg-sunk border-b border-tm-bd">
        <button
          onClick={onBack}
          className="font-mono text-[11px] text-tm-tx-dim hover:text-tm-tx transition-colors shrink-0"
        >
          ← BACK
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-tm-tx truncate">{group.name}</p>
          {isLive && liveState && <LiveMatchHeader state={liveState} />}
        </div>
        <p className="font-mono text-[10px] text-tm-tx-mut shrink-0 tracking-wider uppercase">
          {group.sport} · {group.league} · {formatDate(group.startTime)}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="mb-4 flex justify-end">
          <OddsLegend />
        </div>

        {/* Moneyline (NA sports) */}
        {american && (mlHome || mlAway) && (
          <DetailSection title="MONEYLINE">
            <div className="grid grid-cols-2 gap-2">
              {[mlHome, mlAway].map((outcome, i) =>
                outcome ? (
                  <BestCard
                    key={outcome.outcomeId}
                    outcome={outcome}
                    matchName={group.name}
                    selection={selection}
                    onOddsClick={onOddsClick}
                  />
                ) : (
                  <div key={i} />
                ),
              )}
            </div>
          </DetailSection>
        )}

        {/* 1X2 — Match Result (soccer only): 3 columns × 2 rows, YES over NOT */}
        {!american && (home || draw || away) && (
          <DetailSection title="MATCH RESULT · 1X2">
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { yes: home,  not: notHome, col: '1', label: team1 },
                { yes: draw,  not: notDraw, col: 'X', label: 'Draw' },
                { yes: away,  not: notAway, col: '2', label: team2 },
              ].map(({ yes, not, col }, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  {yes ? (
                    <BestCard
                      outcome={yes}
                      matchName={group.name}
                      columnLabel={col}
                      selection={selection}
                      onOddsClick={onOddsClick}
                    />
                  ) : (
                    <div className="h-[42px] border border-tm-bd rounded-[var(--tm-rad)] bg-tm-bg-el/40" />
                  )}
                  {not ? (
                    <BestCard
                      outcome={not}
                      matchName={group.name}
                      columnLabel={col}
                      selection={selection}
                      onOddsClick={onOddsClick}
                    />
                  ) : (
                    <div className="h-[42px] border border-tm-bd rounded-[var(--tm-rad)] bg-tm-bg-el/40" />
                  )}
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        {/* Totals */}
        {totalsPairs.length > 0 && (
          <DetailSection title="TOTALS">
            <div className="space-y-1.5">
              {totalsPairs.map(([left, right], i) => (
                <PairedRow
                  key={i}
                  left={left}
                  right={right}
                  matchName={group.name}
                  selection={selection}
                  onOddsClick={onOddsClick}
                />
              ))}
            </div>
          </DetailSection>
        )}

        {/* Handicap / Spread */}
        {handicapsPairs.length > 0 && (
          <DetailSection title="HANDICAP">
            <div className="space-y-1.5">
              {handicapsPairs.map(([left, right], i) => (
                <PairedRow
                  key={i}
                  left={left}
                  right={right}
                  matchName={group.name}
                  selection={selection}
                  onOddsClick={onOddsClick}
                />
              ))}
            </div>
          </DetailSection>
        )}

        {/* Other markets */}
        {othersPairs.length > 0 && (
          <DetailSection title="OTHER MARKETS">
            <div className="space-y-1.5">
              {othersPairs.map(([left, right], i) => (
                <PairedRow
                  key={i}
                  left={left}
                  right={right}
                  matchName={group.name}
                  selection={selection}
                  onOddsClick={onOddsClick}
                />
              ))}
            </div>
          </DetailSection>
        )}
      </div>
    </div>
  );
}
