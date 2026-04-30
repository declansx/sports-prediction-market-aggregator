/**
 * One-off: merge duplicate Event rows for the same logical game.
 *
 * Strategy: group active events by (league, sorted-team-pair, startTime within
 * 4-hour window). For each group with >1 event:
 *  1. Pick the "primary" event — the one with the most markets (ties broken by
 *     having sxEventId, then by oldest createdAt).
 *  2. Move every Market and CanonicalBet from the duplicates onto the primary.
 *     If the primary already has a Market with the same (platform, externalId),
 *     re-point Outcomes from the duplicate's Market to the primary's instead
 *     and delete the duplicate Market.
 *  3. Repoint Outcome.canonicalBetId entries on the duplicate's CanonicalBet
 *     rows onto the primary's matching (eventId, key) row, find-or-creating it.
 *  4. Backfill primary's sxEventId / polyEventId from any duplicate.
 *  5. Delete the now-empty duplicate Event rows.
 *
 * Usage: npx ts-node --project tsconfig.scripts.json --transpile-only scripts/mergeDuplicateEvents.ts
 *        --dry-run    print what would be merged, no writes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

async function main() {
  const dry = process.argv.includes('--dry-run');
  const events = await prisma.event.findMany({
    where: { status: 'active' },
    include: { _count: { select: { markets: true } } },
    orderBy: [{ league: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
  });

  // Group: events that share ANY of {sxEventId, polyEventId} are the same
  // logical game. As a fallback, also group by (league, sorted-team-key, 4h
  // time-bucket). Events that match either grouping are merged.
  //
  // Build via a union-find: for each event, collect "fingerprints"
  // (platform IDs and team-bucket key) and union all events that share any
  // fingerprint.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let p = parent.get(x) ?? x;
    while (p !== (parent.get(p) ?? p)) {
      const next = parent.get(p) ?? p;
      parent.set(p, next);
      p = next;
    }
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const fingerprintToEvent = new Map<string, string>();
  for (const e of events) parent.set(e.id, e.id);
  for (const e of events) {
    const fps: string[] = [];
    if (e.sxEventId) fps.push(`sx:${e.sxEventId}`);
    if (e.polyEventId) fps.push(`poly:${e.polyEventId}`);
    const teams = [e.homeTeam, e.awayTeam].sort().join('||');
    const bucket = Math.floor(e.startTime.getTime() / FOUR_HOURS_MS);
    fps.push(`tb:${e.league}\x01${teams}\x01${bucket}`);
    for (const fp of fps) {
      const prev = fingerprintToEvent.get(fp);
      if (prev) union(prev, e.id);
      else fingerprintToEvent.set(fp, e.id);
    }
  }

  const groups = new Map<string, typeof events>();
  for (const e of events) {
    const root = find(e.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(e);
  }

  let mergedGroups = 0;
  let removedEvents = 0;

  for (const [, evs] of groups) {
    if (evs.length < 2) continue;

    // Pick primary: most markets, then has sxEventId, then oldest
    const primary = [...evs].sort((a, b) => {
      if (b._count.markets !== a._count.markets) return b._count.markets - a._count.markets;
      const aSx = a.sxEventId ? 1 : 0;
      const bSx = b.sxEventId ? 1 : 0;
      if (bSx !== aSx) return bSx - aSx;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })[0];

    const dups = evs.filter((e) => e.id !== primary.id);

    console.log(`\n${primary.league} :: ${primary.homeTeam} vs ${primary.awayTeam}`);
    console.log(
      `  PRIMARY ${primary.id}  sx=${primary.sxEventId ?? '—'}  poly=${primary.polyEventId ?? '—'}  ` +
        `markets=${primary._count.markets}`,
    );
    for (const d of dups) {
      console.log(
        `  dup     ${d.id}  sx=${d.sxEventId ?? '—'}  poly=${d.polyEventId ?? '—'}  ` +
          `markets=${d._count.markets}`,
      );
    }
    if (dry) continue;

    for (const d of dups) {
      // Backfill primary's missing platform IDs
      const updates: { sxEventId?: string; polyEventId?: string } = {};
      if (!primary.sxEventId && d.sxEventId) updates.sxEventId = d.sxEventId;
      if (!primary.polyEventId && d.polyEventId) updates.polyEventId = d.polyEventId;
      if (Object.keys(updates).length) {
        await prisma.event.update({ where: { id: primary.id }, data: updates });
        if (updates.sxEventId) primary.sxEventId = updates.sxEventId;
        if (updates.polyEventId) primary.polyEventId = updates.polyEventId;
      }

      // Re-point markets from dup → primary, handling (platform, externalId) collisions
      const dupMarkets = await prisma.market.findMany({ where: { eventId: d.id } });
      for (const dm of dupMarkets) {
        // Look for an existing market on the primary with same (platform, externalId)
        const existing = await prisma.market.findUnique({
          where: { platform_externalId: { platform: dm.platform, externalId: dm.externalId } },
        });
        if (existing && existing.id !== dm.id && existing.eventId === primary.id) {
          // Already on primary — repoint the dup market's outcomes onto the primary's, then delete
          const dupOutcomes = await prisma.outcome.findMany({ where: { marketId: dm.id } });
          for (const dout of dupOutcomes) {
            const existingOutcome = await prisma.outcome.findFirst({
              where: { marketId: existing.id, label: dout.label },
            });
            if (existingOutcome) {
              // Repoint trades onto existing outcome, then delete dup outcome
              await prisma.trade.updateMany({
                where: { outcomeId: dout.id },
                data: { outcomeId: existingOutcome.id },
              });
              await prisma.outcome.delete({ where: { id: dout.id } });
            } else {
              await prisma.outcome.update({
                where: { id: dout.id },
                data: { marketId: existing.id },
              });
            }
          }
          await prisma.trade.updateMany({
            where: { marketId: dm.id },
            data: { marketId: existing.id },
          });
          await prisma.market.delete({ where: { id: dm.id } });
        } else {
          // Just re-point the market to the primary
          await prisma.market.update({ where: { id: dm.id }, data: { eventId: primary.id } });
        }
      }

      // The duplicate event may have had different home/away than the primary
      // (e.g. SX correctly set home=NYK, Polymarket created a sibling with
      // home=Atlanta). Outcomes linked to the dup's canonical bets were keyed
      // against the dup's perspective and would be incorrect on the primary.
      // Simplest correct path: clear canonicalBetId on every outcome we moved
      // to the primary. The next sync cycle re-links them against the
      // primary's (correct) home/away via linkCanonicalBet.
      await prisma.outcome.updateMany({
        where: { market: { eventId: primary.id } },
        data: { canonicalBetId: null },
      });
      await prisma.canonicalBet.deleteMany({
        where: { OR: [{ eventId: d.id }, { eventId: primary.id }] },
      });

      // Finally delete the empty duplicate event
      await prisma.event.delete({ where: { id: d.id } });
      removedEvents++;
    }
    mergedGroups++;
  }

  console.log(
    `\n${dry ? '[dry-run] ' : ''}Done. Merged ${mergedGroups} groups, removed ${removedEvents} duplicate event rows.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
