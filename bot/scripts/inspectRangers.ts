import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  // Find Rangers +1.5 canonical bet's outcomes (from the trade record's canonicalBetId)
  const cbid = 'cmohlxqpl02bvb8dfcxxklqyi';
  const cb = await prisma.canonicalBet.findUnique({ where: { id: cbid } });
  console.log('CanonicalBet:', cb);

  const outcomes = await prisma.outcome.findMany({
    where: { canonicalBetId: cbid },
    include: { market: true },
  });

  for (const o of outcomes) {
    console.log({
      id: o.id,
      label: o.label,
      platform: o.market.platform,
      mainLine: o.market.mainLine,
      currentOdds: o.currentOdds,
      currentDecimal: (1/o.currentOdds).toFixed(3),
      liquidityDepth: o.liquidityDepth,
      lastUpdated: o.lastUpdated.toISOString(),
      levels: o.liquidityLevels ? JSON.parse(o.liquidityLevels).map((l: { odds: number; size: number }) => ({
        impliedOdds: l.odds,
        decimal: (1/l.odds).toFixed(3),
        size: l.size,
      })) : null,
    });
  }
  await prisma.$disconnect();
})();
