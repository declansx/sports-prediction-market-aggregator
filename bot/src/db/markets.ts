import { prisma } from './index';
import { recordAlias } from './teamAlias';
import { canonicalTeamName } from '../adapters/teamNames';
import { canonicalize } from '../router/canonicalize';
import type { MarketQuote } from '../types';
import { createLogger } from '../logger';

const log = createLogger('db');

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const NY_DAY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface UpsertSummary {
  linked: number;
  skipped: number;
}

/**
 * After an SX NBA quote resolves to an Event row, look for any PM-only twin on the
 * same ET calendar day with matching team set and absorb it. Two NBA games between
 * the same teams never happen on the same ET day, so any same-team same-ET-day
 * PM-only row is the same game.
 *
 * This covers three failure modes that all produce duplicate rows:
 *  - PM uses "midnight ET" as gameStartTime (placeholder ~19h before real tipoff),
 *    pushing the PM row outside the ±2h Path-2 window so SX forks a separate row.
 *  - PM gl (spread/total) quotes historically didn't carry polyEventId, so they
 *    landed on Path-3 and created orphan Events with no platform IDs.
 *  - PM created an event when its title-ordering config was wrong, then was
 *    corrected; SX never overwrites PM home/away so the stale flip persists.
 *
 * Folding the PM markets onto the SX Event lets canonical bets unify and the
 * dashboard show combined SX+PM liquidity per outcome.
 */
async function absorbNbaPlaceholderTwin<T extends { id: string; league: string; homeTeam: string; awayTeam: string; startTime: Date; sxEventId: string | null; polyEventId: string | null }>(
  sxEvent: T,
): Promise<T> {
  if (sxEvent.league !== 'NBA') return sxEvent;
  if (!sxEvent.sxEventId) return sxEvent;
  // Note: don't short-circuit when sxEvent.polyEventId is set — orphan rows
  // (no IDs at all, created by historical PM gl quotes that lacked polyEventId)
  // can coexist with the merged row and still need to be absorbed.

  const targetEtDay = NY_DAY_FMT.format(sxEvent.startTime);
  // Bound the SQL search by ±30h so we don't scan the table; the post-filter
  // below pins to the same ET calendar day.
  const bound = 30 * 60 * 60 * 1000;
  const candidates = await prisma.event.findMany({
    where: {
      league: 'NBA',
      sxEventId: null,
      // Anything without sxEventId is fair game — PM-tagged rows (placeholder
      // or real time) and orphan rows alike. SX is authoritative; merge into it.
      startTime: {
        gte: new Date(sxEvent.startTime.getTime() - bound),
        lte: new Date(sxEvent.startTime.getTime() + bound),
      },
      OR: [
        { homeTeam: sxEvent.homeTeam, awayTeam: sxEvent.awayTeam },
        { homeTeam: sxEvent.awayTeam, awayTeam: sxEvent.homeTeam },
      ],
    },
  });

  const twins = candidates.filter(
    (c) => NY_DAY_FMT.format(c.startTime) === targetEtDay,
  );
  if (twins.length === 0) return sxEvent;
  // Pick the first PM-tagged twin to inherit polyEventId; fall through if all
  // are orphans (no polyEventId on any).
  const inheritedPolyEventId = twins.find((t) => t.polyEventId)?.polyEventId ?? null;

  log.info(
    {
      sxEventId: sxEvent.id,
      twinIds: twins.map((t) => t.id),
      polyEventIds: twins.map((t) => t.polyEventId),
      etDay: targetEtDay,
    },
    'absorbing PM NBA midnight-ET twin(s) into SX event',
  );

  const twinIds = twins.map((t) => t.id);
  await prisma.$transaction(async (tx) => {
    const pmMarkets = await tx.market.findMany({
      where: { eventId: { in: twinIds } },
      select: { id: true },
    });
    const pmMarketIds = pmMarkets.map((m) => m.id);
    if (pmMarketIds.length) {
      // Outcome.canonicalBet has no cascade; null it before deleting twin events
      // so the next link cycle re-binds against the SX event's canonical bets.
      await tx.outcome.updateMany({
        where: { marketId: { in: pmMarketIds } },
        data: { canonicalBetId: null },
      });
    }
    await tx.market.updateMany({
      where: { eventId: { in: twinIds } },
      data: { eventId: sxEvent.id },
    });
    if (inheritedPolyEventId && !sxEvent.polyEventId) {
      await tx.event.update({
        where: { id: sxEvent.id },
        data: { polyEventId: inheritedPolyEventId },
      });
    }
    await tx.event.deleteMany({ where: { id: { in: twinIds } } });
  });

  return inheritedPolyEventId && !sxEvent.polyEventId
    ? { ...sxEvent, polyEventId: inheritedPolyEventId }
    : sxEvent;
}

async function findOrCreateEvent(quote: MarketQuote & { homeTeam: string; awayTeam: string }) {
  const event = await findOrCreateEventCore(quote);
  if (quote.platform === 'sx' && quote.league === 'NBA') {
    return absorbNbaPlaceholderTwin(event);
  }
  return event;
}

async function findOrCreateEventCore(quote: MarketQuote & { homeTeam: string; awayTeam: string }) {
  const home = canonicalTeamName(quote.homeTeam, quote.sport);
  const away = canonicalTeamName(quote.awayTeam, quote.sport);

  // 1. Try stable platform IDs first — sxEventId / polyEventId survive alias edits.
  if (quote.sxEventId || quote.polyEventId) {
    const byPlatform = await prisma.event.findFirst({
      where: {
        OR: [
          quote.sxEventId ? { sxEventId: quote.sxEventId } : { id: '__never__' },
          quote.polyEventId ? { polyEventId: quote.polyEventId } : { id: '__never__' },
        ],
      },
    });

    if (byPlatform) {
      // Determine whether to update the event's home/away assignment.
      //
      // SX is AUTHORITATIVE for home/away — team1 is invariantly the home
      // team across the platform. Polymarket's title parsing is sport-
      // dependent: soccer titles list home first ("Real Madrid vs Barcelona"
      // = Madrid at home), but US-sport titles list away first ("Tampa Bay
      // Rays vs Cleveland Guardians" = Tampa is the visitor at Cleveland).
      // If we let Polymarket overwrite home/away, MLB/NBA/NHL events
      // ping-pong every cycle: SX flips back to correct, Polymarket flips to
      // wrong, and canonical bets get wiped both times.
      //
      // Cases:
      //  (a) Team set changed → genuine rename ("Tampa Bay" → "Tampa Bay
      //      Rays" via an alias correction). Update + clear canonical bets.
      //  (b) Home/away flipped, same team set, sync is SX → correction.
      //      Update + clear canonical bets.
      //  (c) Home/away flipped, same team set, sync is Polymarket → ignore.
      //      Keep existing assignment, don't clear canonical bets.
      const oldTeams = new Set([byPlatform.homeTeam, byPlatform.awayTeam]);
      const sameTeams = oldTeams.has(home) && oldTeams.has(away);
      const trulyRenamed = !sameTeams;
      const homeAwayFlipped =
        sameTeams && byPlatform.homeTeam !== home;
      const isSx = quote.platform === 'sx';
      const shouldUpdateTeams = trulyRenamed || (homeAwayFlipped && isSx);

      if (shouldUpdateTeams) {
        log.info(
          {
            eventId: byPlatform.id,
            oldHomeTeam: byPlatform.homeTeam,
            oldAwayTeam: byPlatform.awayTeam,
            newHomeTeam: home,
            newAwayTeam: away,
            reason: trulyRenamed ? 'rename' : 'sx_home_away_correction',
          },
          'event home/away updated',
        );
        // Drop canonical bets so the next link cycle rebuilds keys against
        // the corrected home/away assignment.
        await prisma.canonicalBet.deleteMany({ where: { eventId: byPlatform.id } });
      }

      // SX is authoritative for NBA startTime — Polymarket sometimes uses a
      // midnight-ET placeholder (~19h before real tipoff). Don't let a PM
      // update overwrite startTime once SX has claimed the event.
      const skipPmStartTime =
        quote.platform === 'polymarket' &&
        quote.league === 'NBA' &&
        !!byPlatform.sxEventId;

      await prisma.event.update({
        where: { id: byPlatform.id },
        data: {
          status: 'active',
          ...(skipPmStartTime ? {} : { startTime: quote.startTime }),
          ...(shouldUpdateTeams ? { homeTeam: home, awayTeam: away } : {}),
          ...(quote.sxEventId && !byPlatform.sxEventId ? { sxEventId: quote.sxEventId } : {}),
          ...(quote.polyEventId && !byPlatform.polyEventId ? { polyEventId: quote.polyEventId } : {}),
        },
      });

      return shouldUpdateTeams
        ? { ...byPlatform, homeTeam: home, awayTeam: away }
        : byPlatform;
    }
  }

  // 2. Fall back to league + ±2h window + team-name OR (handles first time we see one platform).
  const existing = await prisma.event.findFirst({
    where: {
      league: quote.league,
      startTime: {
        gte: new Date(quote.startTime.getTime() - TWO_HOURS_MS),
        lte: new Date(quote.startTime.getTime() + TWO_HOURS_MS),
      },
      OR: [
        { homeTeam: home, awayTeam: away },
        { homeTeam: away, awayTeam: home },
      ],
    },
  });

  if (existing) {
    // If this quote is from SX (the authoritative source for home/away) and
    // the existing event has the home/away flipped, correct it. This handles
    // the case where Polymarket created the event first with its sport-
    // dependent title ordering, then SX arrives and needs to fix the
    // assignment.
    const isSx = quote.platform === 'sx';
    const homeAwayFlipped = existing.homeTeam !== home || existing.awayTeam !== away;
    const shouldUpdateTeams = isSx && homeAwayFlipped;
    if (shouldUpdateTeams) {
      log.info(
        {
          eventId: existing.id,
          oldHomeTeam: existing.homeTeam,
          oldAwayTeam: existing.awayTeam,
          newHomeTeam: home,
          newAwayTeam: away,
        },
        'event home/away corrected by SX (path 2)',
      );
      await prisma.canonicalBet.deleteMany({ where: { eventId: existing.id } });
    }
    await prisma.event.update({
      where: { id: existing.id },
      data: {
        status: 'active',
        startTime: quote.startTime,
        ...(shouldUpdateTeams ? { homeTeam: home, awayTeam: away } : {}),
        ...(quote.sxEventId && !existing.sxEventId ? { sxEventId: quote.sxEventId } : {}),
        ...(quote.polyEventId && !existing.polyEventId ? { polyEventId: quote.polyEventId } : {}),
      },
    });
    return shouldUpdateTeams
      ? { ...existing, homeTeam: home, awayTeam: away }
      : existing;
  }

  return prisma.event.create({
    data: {
      sport: quote.sport,
      league: quote.league,
      homeTeam: home,
      awayTeam: away,
      startTime: quote.startTime,
      status: 'active',
      sxEventId: quote.sxEventId ?? null,
      polyEventId: quote.polyEventId ?? null,
    },
  });
}

async function linkCanonicalBet(
  outcomeId: string,
  label: string,
  betType: string,
  line: number | null,
  eventId: string,
  homeTeam: string,
  awayTeam: string,
): Promise<{ linked: boolean; reason?: string }> {
  const result = canonicalize(label, betType, homeTeam, awayTeam);
  if (!result.parts) {
    return { linked: false, reason: result.reason };
  }
  const { key, betType: canonBetType, side, line: canonLine } = result.parts;

  // Find-or-create the CanonicalBet for (eventId, key); idempotent under @@unique.
  let canonical = await prisma.canonicalBet.findUnique({
    where: { eventId_key: { eventId, key } },
  });
  if (!canonical) {
    try {
      canonical = await prisma.canonicalBet.create({
        data: { eventId, key, betType: canonBetType, side, line: canonLine },
      });
    } catch {
      // Race: another upsert won — re-read.
      canonical = await prisma.canonicalBet.findUnique({
        where: { eventId_key: { eventId, key } },
      });
      if (!canonical) return { linked: false, reason: 'failed to upsert canonical bet' };
    }
  }

  await prisma.outcome.update({
    where: { id: outcomeId },
    data: { canonicalBetId: canonical.id },
  });
  return { linked: true };
  // Suppress unused 'line' arg (kept for callsite ergonomics; canonical line is on parts).
  void line;
}

export async function upsertMarkets(quotes: MarketQuote[]): Promise<UpsertSummary> {
  let linked = 0;
  let skipped = 0;

  for (const quote of quotes) {
    if (!quote.homeTeam || !quote.awayTeam) {
      log.warn({ externalId: quote.externalId, platform: quote.platform }, 'skipping quote with missing teams');
      continue;
    }

    try {
      // 1. Find or create the canonical Event (handles home/away swap + name normalization)
      const event = await findOrCreateEvent(quote);

      // 2. Upsert the Market linked to the Event
      const market = await prisma.market.upsert({
        where: {
          platform_externalId: { platform: quote.platform, externalId: quote.externalId },
        },
        create: {
          eventId: event.id,
          platform: quote.platform,
          externalId: quote.externalId,
          startTime: quote.startTime,
          status: 'active',
          betType: quote.betType,
          line: quote.line,
          mainLine: quote.mainLine ?? true,
        },
        update: {
          eventId: event.id,
          startTime: quote.startTime,
          status: 'active',
          betType: quote.betType,
          line: quote.line,
          mainLine: quote.mainLine ?? true,
        },
      });

      // 3. Upsert outcomes
      const existingOutcomes = await prisma.outcome.findMany({
        where: { marketId: market.id },
      });

      for (const outcomeData of quote.outcomes) {
        const levelsJson = JSON.stringify(outcomeData.liquidityDepth.topLevels);
        const existing = existingOutcomes.find((e) => e.label === outcomeData.label);

        let outcomeId: string;
        let alreadyLinked = false;
        if (existing) {
          outcomeId = existing.id;
          alreadyLinked = existing.canonicalBetId !== null;
          await prisma.outcome.update({
            where: { id: existing.id },
            data: {
              currentOdds: outcomeData.impliedOdds,
              liquidityDepth: outcomeData.liquidityDepth.availableSize,
              liquidityLevels: levelsJson,
              externalId: outcomeData.externalId ?? existing.externalId,
              lastUpdated: new Date(),
            },
          });
        } else {
          const created = await prisma.outcome.create({
            data: {
              marketId: market.id,
              label: outcomeData.label,
              externalId: outcomeData.externalId,
              currentOdds: outcomeData.impliedOdds,
              liquidityDepth: outcomeData.liquidityDepth.availableSize,
              liquidityLevels: levelsJson,
            },
          });
          outcomeId = created.id;
        }

        if (!alreadyLinked) {
          const linkRes = await linkCanonicalBet(
            outcomeId,
            outcomeData.label,
            quote.betType,
            quote.line ?? null,
            event.id,
            event.homeTeam,
            event.awayTeam,
          );
          if (linkRes.linked) {
            linked++;
          } else {
            skipped++;
            log.debug(
              {
                platform: quote.platform,
                label: outcomeData.label,
                betType: quote.betType,
                line: quote.line ?? null,
                homeTeam: event.homeTeam,
                awayTeam: event.awayTeam,
                reason: linkRes.reason,
              },
              'canonicalize skipped',
            );
          }
        }
      }

      // 4. Remove stale outcomes that have no trades/positions
      const currentLabels = quote.outcomes.map((o) => o.label);
      const deleted = await prisma.outcome.deleteMany({
        where: {
          marketId: market.id,
          label: { notIn: currentLabels },
          trades: { none: {} },
        },
      });
      if (deleted.count > 0) {
        log.info({ count: deleted.count, externalId: quote.externalId }, 'removed stale outcomes');
      }

      // 5. Record team aliases outside the transaction (best-effort, non-fatal)
      recordAlias(quote.homeTeam, quote.platform, quote.homeTeam, quote.league).catch((err) => {
        log.error({ err, platform: quote.platform, team: quote.homeTeam }, 'recordAlias failed');
      });
      recordAlias(quote.awayTeam, quote.platform, quote.awayTeam, quote.league).catch((err) => {
        log.error({ err, platform: quote.platform, team: quote.awayTeam }, 'recordAlias failed');
      });
    } catch (err) {
      log.error({ err, externalId: quote.externalId, platform: quote.platform }, 'failed to upsert market');
    }
  }

  return { linked, skipped };
}
