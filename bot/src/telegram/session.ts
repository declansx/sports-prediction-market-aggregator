export interface PendingTradeSession {
  outcomeId: string;
  outcomeLabel: string;
  marketId: string;
  sport: string;
  league: string;
  page: number;
  promptMessageId?: number;
  size?: number;
}

export const pendingTrades = new Map<number, PendingTradeSession>();
