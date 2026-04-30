/**
 * One-off: walk every Outcome with canonicalBetId === null and attempt to link
 * it. Use the production canonicalize() against the outcome's market.event row
 * (current home/away). Find-or-creates CanonicalBet rows on the event.
 *
 * Run after canonicalize() shape changes or after clearCanonicalBets — the
 * normal sync cycle only re-links outcomes whose markets are returned by the
 * adapter THIS cycle, so stale-but-active outcomes need this script.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json --transpile-only scripts/backfillCanonicalBets.ts
 *   npx ts-node ... scripts/backfillCanonicalBets.ts --dry-run  # report only, no writes
 */

import { PrismaClient } from '@prisma/client';
import { canonicalize } from '../src/router/canonicalize';

const prisma = new PrismaClient();

async function main() {
  const dry = process.argv.includes('--dry-run');

  const outcomes = await prisma.outcome.findMany({
    where: { canonicalBetId: null },
    include: { market: { include: { event: true } } },
  });

  console.log(`Found ${outcomes.length} outcomes with canonicalBetId=null.`);

  let linked = 0;
  let skipped = 0;
  const reasons = new Map<string, number>();

  for (const o of outcomes) {
    const ev = o.market.event;
    const result = canonicalize(o.label, o.market.betType, ev.homeTeam, ev.awayTeam);
    if (!result.parts) {
      skipped++;
      const r = result.reason ?? 'unknown';
      reasons.set(r, (reasons.get(r) ?? 0) + 1);
      continue;
    }

    const { key, betType, side, line } = result.parts;

    if (dry) {
      linked++;
      continue;
    }

    let canonical = await prisma.canonicalBet.findUnique({
      where: { eventId_key: { eventId: ev.id, key } },
    });
    if (!canonical) {
      try {
        canonical = await prisma.canonicalBet.create({
          data: { eventId: ev.id, key, betType, side, line },
        });
      } catch {
        canonical = await prisma.canonicalBet.findUnique({
          where: { eventId_key: { eventId: ev.id, key } },
        });
        if (!canonical) {
          skipped++;
          continue;
        }
      }
    }
    await prisma.outcome.update({
      where: { id: o.id },
      data: { canonicalBetId: canonical.id },
    });
    linked++;
  }

  console.log(`${dry ? '[dry-run] ' : ''}linked: ${linked}, skipped: ${skipped}`);
  if (reasons.size > 0) {
    console.log('skip reasons:');
    for (const [r, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${n.toString().padStart(5)}  ${r}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
