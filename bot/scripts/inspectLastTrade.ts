import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const trades = await prisma.trade.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { market: { include: { event: true } }, outcome: true },
  });
  for (const t of trades) {
    console.log({
      id: t.id,
      createdAt: t.createdAt,
      platform: t.platform,
      side: t.side,
      requestedSize: t.requestedSize,
      requestedOdds: t.requestedOdds,
      fillOdds: t.fillOdds,
      executedSize: t.executedSize,
      status: t.status,
      txHash: t.txHash,
      outcomeLabel: t.outcome.label,
      outcomeCanonicalBetId: t.outcome.canonicalBetId,
      event: `${t.market.event.homeTeam} vs ${t.market.event.awayTeam}`,
      eventStart: t.market.event.startTime.toISOString(),
    });
  }
  await prisma.$disconnect();
})();
