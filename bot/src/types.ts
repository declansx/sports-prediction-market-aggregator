export type Platform = 'sx' | 'polymarket';
export type Side = 'buy' | 'sell';

export interface LiquidityDepth {
  availableSize: number; // Total USDC available across all orders for this outcome
  topLevels: Array<{ odds: number; size: number }>; // Up to 5 order book levels, best first
}

export interface OutcomeOdds {
  label: string; // e.g. "Miami Heat", "Over 2.5", "Yes"
  impliedOdds: number; // Taker implied probability 0–1
  liquidityDepth: LiquidityDepth;
  externalId?: string; // tokenId (Polymarket) | outcome index "0"/"1" (SX Bet)
}

export interface MarketQuote {
  platform: Platform;
  externalId: string;    // marketHash (SX Bet) | event.id (Poly 1x2) | conditionId (Poly spread/total)
  sport: string;
  league: string;
  homeTeam: string;      // canonical normalized name
  awayTeam: string;      // canonical normalized name
  name: string;          // human-readable display (derived: homeTeam + " vs " + awayTeam)
  startTime: Date;
  betType: string;       // "1x2" | "12" | "spread" | "total"
  line?: number;         // handicap or total value for spread/total markets
  mainLine?: boolean;    // true if this is the primary line (not an alt line)
  outcomes: OutcomeOdds[];
  sxEventId?: string;    // sportXeventId e.g. "L18511902" (SX only)
  polyEventId?: string;  // Polymarket Gamma event id e.g. "341080" (Polymarket 1x2 only)
}

// --- Order routing ---

export interface TradeRequest {
  marketId: string; // DB Market.id
  outcomeId: string; // DB Outcome.id
  side: Side;
  size: number; // USDC
}

export interface Allocation {
  platform: Platform;
  outcomeId: string; // DB Outcome.id
  externalMarketId: string; // marketHash (SX Bet) | conditionId (Polymarket)
  externalOutcomeId: string; // "0"/"1" (SX Bet) | tokenId (Polymarket)
  size: number; // USDC to allocate to this platform
  expectedOdds: number; // Weighted average fill odds 0–1
  estimatedSlippage: number; // Fractional slippage vs best available odds
}

export interface AllocationPlan {
  allocations: Allocation[];
  totalSize: number; // Sum of all allocation sizes
  weightedOdds: number; // Overall weighted average odds
  totalSlippage: number; // Worst slippage across all allocations
}
