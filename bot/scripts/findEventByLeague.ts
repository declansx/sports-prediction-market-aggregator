import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const league = process.argv[2];
  if (!league) {
    console.error('Usage: findEventByLeague <league>');
    process.exit(1);
  }
  const events = await prisma.event.findMany({
    where: {
      league,
      status: 'active',
      markets: { some: { platform: 'sx' } },
      AND: { markets: { some: { platform: 'polymarket' } } },
    },
    include: { _count: { select: { markets: true } } },
    orderBy: { startTime: 'asc' },
    take: 5,
  });
  for (const e of events) {
    console.log(`${e.id}  ${e.homeTeam} vs ${e.awayTeam}  start=${e.startTime.toISOString()}  markets=${e._count.markets}`);
  }
  await prisma.$disconnect();
})();
