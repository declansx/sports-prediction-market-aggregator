import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const trades = await prisma.trade.count();
  const events = await prisma.event.count();
  const activeEvents = await prisma.event.count({ where: { status: 'active' } });
  const markets = await prisma.market.count();
  const outcomes = await prisma.outcome.count();
  const linked = await prisma.outcome.count({ where: { canonicalBetId: { not: null } } });
  const cbets = await prisma.canonicalBet.count();
  console.log({
    trades,
    events,
    activeEvents,
    markets,
    outcomes,
    linked,
    unlinked: outcomes - linked,
    canonicalBets: cbets,
  });
  await prisma.$disconnect();
})();
