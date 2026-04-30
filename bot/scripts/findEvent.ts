import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const events = await prisma.event.findMany({
    where: { league: 'Copa Libertadores' },
    include: { _count: { select: { markets: true } } },
    orderBy: { createdAt: 'desc' },
  });
  for (const e of events) {
    console.log(`${e.id}  ${e.homeTeam} vs ${e.awayTeam}  startTime=${e.startTime.toISOString()}  markets=${e._count.markets}  status=${e.status}`);
  }
  await prisma.$disconnect();
})();
