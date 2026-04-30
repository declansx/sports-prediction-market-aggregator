import { prisma } from './index';

export interface PendingTradeInput {
  marketId: string;
  outcomeId: string;
  platform: string;
  side: string;
  requestedSize: number;
  requestedOdds: number;
}

export async function createPendingTrade(input: PendingTradeInput): Promise<string> {
  const trade = await prisma.trade.create({
    data: {
      marketId: input.marketId,
      outcomeId: input.outcomeId,
      platform: input.platform,
      side: input.side,
      requestedSize: input.requestedSize,
      requestedOdds: input.requestedOdds,
      status: 'pending',
    },
  });
  return trade.id;
}

export async function markTradeFilled(
  tradeId: string,
  txHash: string,
  executedSize: number,
  fillOdds: number,
): Promise<void> {
  await prisma.trade.update({
    where: { id: tradeId },
    data: {
      status: 'filled',
      txHash,
      executedSize,
      fillOdds,
    },
  });
}

export async function markTradeFailed(tradeId: string, reason: string): Promise<void> {
  await prisma.trade.update({
    where: { id: tradeId },
    data: {
      status: 'failed',
      failureReason: reason,
    },
  });
}

export async function getTrade(tradeId: string) {
  return prisma.trade.findUnique({ where: { id: tradeId } });
}
