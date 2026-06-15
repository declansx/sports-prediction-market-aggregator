import { TradePanel } from './TradePanel';

interface BetSlipSelection {
  outcomeId: string;
  label: string;
  matchName: string;
  sxBook?: string;
  polyBook?: string;
}

interface BetSlipProps {
  selection: BetSlipSelection | null;
  onClose: () => void;
  onTradeExecuted: () => void;
}

export function BetSlip({ selection, onClose, onTradeExecuted }: BetSlipProps) {
  return (
    <div className="flex flex-col h-full bg-tm-bg-sunk">
      <div className="shrink-0 flex items-start justify-between gap-2 px-4 py-3 bg-tm-bg-sunk border-b border-tm-bd">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-tm-tx-mut">
            BET SLIP
          </p>
          {selection ? (
            <>
              <p className="text-[13px] font-semibold text-tm-sx mt-1 truncate">
                ▸ {selection.label}
              </p>
              <p className="text-[11px] text-tm-tx-dim mt-0.5 truncate">
                {selection.matchName}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-tm-tx-dim mt-1 truncate">
              Empty
            </p>
          )}
        </div>
        {selection && (
          <button
            onClick={onClose}
            className="shrink-0 w-11 h-11 md:w-6 md:h-6 flex items-center justify-center rounded-sm border border-tm-bd text-tm-tx-dim hover:text-tm-tx hover:bg-tm-bg-el transition-colors text-lg md:text-base leading-none"
            aria-label="Clear bet slip"
          >
            ×
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {selection ? (
          <TradePanel
            outcomeId={selection.outcomeId}
            outcomeLabel={selection.label}
            sxBook={selection.sxBook}
            polyBook={selection.polyBook}
            onTradeExecuted={onTradeExecuted}
            hideHeader
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-full border border-dashed border-tm-bd flex items-center justify-center text-tm-tx-mut text-2xl leading-none mb-4">
              +
            </div>
            <p className="text-[12px] text-tm-tx-dim leading-relaxed">
              Select a market to add it to your bet slip
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
