/**
 * One-off: delete an Event row by id, cascading Markets, Outcomes, and Trades.
 * Used to force a clean re-sync after a teamNames alias correction.
 *
 * Usage: ts-node scripts/deleteEvent.ts <eventId>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const eventId = process.argv[2];
  if (!eventId) {
    console.error('Usage: deleteEvent <eventId>');
    process.exit(1);
  }

  const ev = await prisma.event.findUnique({
    where: { id: eventId },
    include: { markets: { include: { outcomes: true, trades: true } } },
  });
  if (!ev) {
    console.log(`No event found with id ${eventId}`);
    return;
  }

  const marketIds = ev.markets.map((m) => m.id);
  const outcomeIds = ev.markets.flatMap((m) => m.outcomes.map((o) => o.id));
  const tradeCount = ev.markets.reduce((s, m) => s + m.trades.length, 0);

  if (tradeCount > 0) {
    console.error(`Refusing to delete: ${tradeCount} trades reference markets on this event.`);
    process.exit(1);
  }

  console.log(`Deleting event ${eventId} (${ev.homeTeam} vs ${ev.awayTeam})`);
  console.log(`  ${marketIds.length} markets, ${outcomeIds.length} outcomes`);

  await prisma.$transaction([
    prisma.outcome.deleteMany({ where: { id: { in: outcomeIds } } }),
    prisma.market.deleteMany({ where: { id: { in: marketIds } } }),
    prisma.event.delete({ where: { id: eventId } }),
  ]);

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
