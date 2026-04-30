/**
 * dry-run-canonicalize: Walks every Outcome in the DB, computes the canonical
 * bet key it would be assigned, and prints the result. Writes nothing.
 *
 * Usage:
 *   npm run dryrun-canonicalize                          # all events
 *   npm run dryrun-canonicalize -- <eventId>             # one event
 *   npm run dryrun-canonicalize -- <eventId> --unmatched # only unmatched outcomes
 *   npm run dryrun-canonicalize -- --pairs               # group by canonical key, show pairing
 */

import { PrismaClient } from '@prisma/client';
import { canonicalize } from '../src/router/canonicalize';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const eventIdFilter = args.find((a) => !a.startsWith('--'));
  const onlyUnmatched = args.includes('--unmatched');
  const groupByPair = args.includes('--pairs');

  const outcomes = await prisma.outcome.findMany({
    where: eventIdFilter ? { market: { eventId: eventIdFilter } } : undefined,
    include: { market: { include: { event: true } } },
    orderBy: [
      { market: { eventId: 'asc' } },
      { market: { betType: 'asc' } },
      { market: { line: 'asc' } },
      { market: { platform: 'asc' } },
      { label: 'asc' },
    ],
  });

  if (outcomes.length === 0) {
    console.log('No outcomes found.');
    return;
  }

  let lastEventId = '';
  let total = 0;
  let matched = 0;
  const unmatchedReasons = new Map<string, number>();

  interface Row {
    eventId: string;
    eventName: string;
    platform: string;
    betType: string;
    line: number | null;
    label: string;
    key: string | null;
    reason?: string;
  }
  const rows: Row[] = [];

  for (const o of outcomes) {
    const ev = o.market.event;
    const result = canonicalize(o.label, o.market.betType, ev.homeTeam, ev.awayTeam);
    total++;
    const key = result.parts?.key ?? null;
    if (key) matched++;
    else if (result.reason) {
      unmatchedReasons.set(result.reason, (unmatchedReasons.get(result.reason) ?? 0) + 1);
    }
    rows.push({
      eventId: ev.id,
      eventName: `${ev.homeTeam} vs ${ev.awayTeam}`,
      platform: o.market.platform,
      betType: o.market.betType,
      line: o.market.line,
      label: o.label,
      key,
      reason: result.reason,
    });
  }

  if (groupByPair) {
    const byEventAndKey = new Map<string, Row[]>();
    for (const r of rows) {
      if (!r.key) continue;
      const k = `${r.eventId}|${r.key}`;
      const arr = byEventAndKey.get(k) ?? [];
      arr.push(r);
      byEventAndKey.set(k, arr);
    }
    let lastEv = '';
    for (const [compositeKey, group] of [...byEventAndKey.entries()].sort()) {
      const [evId, canonKey] = compositeKey.split('|');
      if (evId !== lastEv) {
        const ev = group[0];
        console.log(`\n=== ${ev.eventName} (${evId}) ===`);
        lastEv = evId;
      }
      const platforms = new Set(group.map((g) => g.platform));
      const flag = platforms.size === 2 ? '✓ paired' : `⚠  ${[...platforms].join('-only')}`;
      console.log(`  ${canonKey.padEnd(28)} ${flag}  (${group.length} outcomes)`);
      for (const g of group) {
        console.log(`     - ${g.platform.padEnd(10)} betType=${g.betType.padEnd(6)} line=${String(g.line).padEnd(5)} "${g.label}"`);
      }
    }
  } else {
    for (const r of rows) {
      if (onlyUnmatched && r.key) continue;
      if (r.eventId !== lastEventId) {
        console.log(`\n=== ${r.eventName} (${r.eventId}) ===`);
        lastEventId = r.eventId;
      }
      const arrow = r.key ? '→' : '✗';
      const tail = r.key ?? `[unmatched: ${r.reason}]`;
      console.log(
        `  ${r.platform.padEnd(10)} ${r.betType.padEnd(6)} line=${String(r.line).padEnd(6)} "${r.label}" ${arrow} ${tail}`,
      );
    }
  }

  console.log(`\n--- summary ---`);
  console.log(`total:    ${total}`);
  console.log(`matched:  ${matched}`);
  console.log(`unmatched: ${total - matched}`);
  if (unmatchedReasons.size > 0) {
    console.log(`unmatched reasons:`);
    for (const [reason, count] of [...unmatchedReasons.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count.toString().padStart(4)}  ${reason}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
