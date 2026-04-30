import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const events = await prisma.event.findMany({
    where: {
      OR: [
        { homeTeam: { contains: 'Atlanta' } },
        { awayTeam: { contains: 'Atlanta' } },
      ],
      status: 'active',
    },
    include: { _count: { select: { markets: true } } },
  });
  for (const e of events) {
    console.log(`${e.id}  home="${e.homeTeam}"  away="${e.awayTeam}"  start=${e.startTime.toISOString()}  sx=${e.sxEventId ?? '—'}  poly=${e.polyEventId ?? '—'}  markets=${e._count.markets}  status=${e.status}`);
  }
  await prisma.$disconnect();
})();
