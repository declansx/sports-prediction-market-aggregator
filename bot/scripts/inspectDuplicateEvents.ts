/**
 * Find and inspect events that look like duplicates of the same game
 * (same league + same canonical team pair, ignoring home/away order, regardless of time).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  const events = await prisma.event.findMany({
    where: { status: 'active' },
    include: { _count: { select: { markets: true } } },
    orderBy: [{ league: 'asc' }, { startTime: 'asc' }],
  });

  // Group by league + sorted-team-key (no time bucket — duplicates can have different start times)
  const groups = new Map<string, typeof events>();
  for (const e of events) {
    const teams = [e.homeTeam, e.awayTeam].sort().join('||');
    const key = `${e.league}\x01${teams}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  let dupGroups = 0;
  let dupEvents = 0;
  for (const [, evs] of groups) {
    if (evs.length < 2) continue;
    dupGroups++;
    dupEvents += evs.length;
    console.log(`\n${evs[0].league} :: ${evs[0].homeTeam} vs ${evs[0].awayTeam}`);
    for (const e of evs) {
      console.log(
        `  ${e.id}  sx=${e.sxEventId ?? '—'}  poly=${e.polyEventId ?? '—'}  ` +
          `start=${e.startTime.toISOString()}  markets=${e._count.markets}`,
      );
    }
  }
  console.log(
    `\nSummary: ${dupGroups} duplicate groups containing ${dupEvents} event rows ` +
      `(out of ${events.length} total active events).`,
  );

  await prisma.$disconnect();
})();
