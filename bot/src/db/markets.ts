import { prisma } from './index';
import { recordAlias } from './teamAlias';
import { canonicalTeamName } from '../adapters/teamNames';
import { canonicalize } from '../router/canonicalize';
import { emitMarketUpsert } from '../services/marketEvents';
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
 * After a quote resolves to an Event row, look for a same-game twin from the
 * other platform that didn't merge into us via Path-1 or Path-2 and absorb it.
 *
 * This covers failure modes that produce duplicate rows:
 *  - One platform uses a placeholder time (e.g. PM's "midnight ET" for NBA),
 *    pushing it outside the Path-2 ±2h window so the second platform forks
 *    a separate row.
 *  - A platform created an event when its title-ordering config was wrong,
 *    then was corrected; the stale row persists.
 *  - Historical quotes that lacked the cross-platform event-id hint went to
 *    Path-3 and created orphan rows.
 *
 * Match rule:
 *   - Same league
 *   - Same team-pair (bidirectional)
 *   - Same ET calendar day
 *   - Twin is missing the just-arrived platform's id
 *
 * Doubleheader safeguard: if more than one candidate matches, do NOT absorb.
 * Multiple same-day same-team rows from the other platform mean there are
 * legitimately multiple games (e.g. an MLB doubleheader) and we can't safely
 * guess which one is our twin. Stable platform ids will reconcile them later.
 */
async function absorbCrossPlatformTwin<T extends { id: string; league: string; homeTeam: string; awayTeam: string; startTime: Date; sxEventId: string | null; polyEventId: string | null }>(
  event: T,
  arrivingPlatform: 'sx' | 'polymarket',
): Promise<T> {
  // Only attempt the absorb when the just-arrived platform's id is set on
  // this event — that's how we know what kind of twin to look for.
  if (arrivingPlatform === 'sx' && !event.sxEventId) return event;
  if (arrivingPlatform === 'polymarket' && !event.polyEventId) return event;

  const twinIsMissing = arrivingPlatform === 'sx' ? 'sxEventId' : 'polyEventId';
  const targetEtDay = NY_DAY_FMT.format(event.startTime);

  // Bound the SQL search by ±30h so we don't scan the table; the post-filter
  // below pins to the same ET calendar day.
  const bound = 30 * 60 * 60 * 1000;
  const candidates = await prisma.event.findMany({
    where: {
      league: event.league,
      [twinIsMissing]: null,
      id: { not: event.id },
      startTime: {
        gte: new Date(event.startTime.getTime() - bound),
        lte: new Date(event.startTime.getTime() + bound),
      },
      OR: [
        { homeTeam: event.homeTeam, awayTeam: event.awayTeam },
        { homeTeam: event.awayTeam, awayTeam: event.homeTeam },
      ],
    },
  });

  const twins = candidates.filter(
    (c) => NY_DAY_FMT.format(c.startTime) === targetEtDay,
  );
  if (twins.length === 0) return event;
  if (twins.length > 1) {
    // Doubleheader / multi-game day. Can't safely pick — leave them all alone.
    log.info(
      {
        eventId: event.id,
        league: event.league,
        candidateIds: twins.map((t) => t.id),
        etDay: targetEtDay,
      },
      'multiple same-day twins — skipping absorb (doubleheader safeguard)',
    );
    return event;
  }

  const twin = twins[0];
  const inheritedSxEventId = arrivingPlatform === 'polymarket' ? twin.sxEventId : null;
  const inheritedPolyEventId = arrivingPlatform === 'sx' ? twin.polyEventId : null;

  log.info(
    {
      eventId: event.id,
      twinId: twin.id,
      arrivingPlatform,
      inheritedSxEventId,
      inheritedPolyEventId,
      etDay: targetEtDay,
    },
    'absorbing cross-platform twin',
  );

  await prisma.$transaction(async (tx) => {
    const twinMarkets = await tx.market.findMany({
      where: { eventId: twin.id },
      select: { id: true },
    });
    const twinMarketIds = twinMarkets.map((m) => m.id);
    if (twinMarketIds.length) {
      // Outcome.canonicalBet uses ON DELETE SET NULL, so deleting the twin
      // would null these anyway — but we want them moved cleanly first so
      // the next link cycle re-binds against the surviving event's bets.
      await tx.outcome.updateMany({
        where: { marketId: { in: twinMarketIds } },
        data: { canonicalBetId: null },
      });
    }
    await tx.market.updateMany({
      where: { eventId: twin.id },
      data: { eventId: event.id },
    });
    const updates: { sxEventId?: string; polyEventId?: string } = {};
    if (inheritedSxEventId && !event.sxEventId) updates.sxEventId = inheritedSxEventId;
    if (inheritedPolyEventId && !event.polyEventId) updates.polyEventId = inheritedPolyEventId;
    if (Object.keys(updates).length) {
      await tx.event.update({ where: { id: event.id }, data: updates });
    }
    await tx.event.delete({ where: { id: twin.id } });
  });

  const merged: T = { ...event };
  if (inheritedSxEventId && !merged.sxEventId) merged.sxEventId = inheritedSxEventId;
  if (inheritedPolyEventId && !merged.polyEventId) merged.polyEventId = inheritedPolyEventId;
  return merged;
}

async function findOrCreateEvent(quote: MarketQuote & { homeTeam: string; awayTeam: string }) {
  const event = await findOrCreateEventCore(quote);
  return absorbCrossPlatformTwin(event, quote.platform as 'sx' | 'polymarket');
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

      // Pre-fetch the Market row so we can detect whether anything actually
      // changed and skip the dashboard broadcast on no-op upserts. Without
      // this gate, every 30s sync cycle re-emits a marketUpsert for every
      // market in the DB — at thousands of markets that's ~MB/s of pointless
      // WebSocket traffic out of the bot.
      const newMainLine = quote.mainLine ?? true;
      const newLine = quote.line ?? null;
      const existingMarket = await prisma.market.findUnique({
        where: {
          platform_externalId: { platform: quote.platform, externalId: quote.externalId },
        },
      });
      let materialChange = !existingMarket;
      if (existingMarket) {
        if (
          existingMarket.eventId !== event.id ||
          existingMarket.status !== 'active' ||
          existingMarket.betType !== quote.betType ||
          existingMarket.line !== newLine ||
          existingMarket.mainLine !== newMainLine ||
          existingMarket.startTime.getTime() !== quote.startTime.getTime()
        ) {
          materialChange = true;
        }
      }

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
          mainLine: newMainLine,
        },
        update: {
          eventId: event.id,
          startTime: quote.startTime,
          status: 'active',
          betType: quote.betType,
          line: quote.line,
          mainLine: newMainLine,
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
          // Track externalId changes — those alter the dashboard's outcome
          // identity (used by trade routing). Currentodds/liquidity flow over
          // the live odds channels, so changes there don't need a marketUpsert.
          if (
            outcomeData.externalId &&
            outcomeData.externalId !== existing.externalId
          ) {
            materialChange = true;
          }
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
          // New outcome — dashboard needs to know.
          materialChange = true;
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
        materialChange = true;
      }

      // 5. Record team aliases outside the transaction (best-effort, non-fatal)
      recordAlias(quote.homeTeam, quote.platform, quote.homeTeam, quote.league).catch((err) => {
        log.error({ err, platform: quote.platform, team: quote.homeTeam }, 'recordAlias failed');
      });
      recordAlias(quote.awayTeam, quote.platform, quote.awayTeam, quote.league).catch((err) => {
        log.error({ err, platform: quote.platform, team: quote.awayTeam }, 'recordAlias failed');
      });

      // 6. Push lifecycle event to dashboard subscribers ONLY when something
      // dashboard-visible actually changed. Currentodds + liquidity flow on
      // the live odds channels, so we skip emit when the upsert is a no-op
      // refresh from the 30s sync.
      if (materialChange) {
        emitMarketUpsert(market.id);
      }
    } catch (err) {
      log.error({ err, externalId: quote.externalId, platform: quote.platform }, 'failed to upsert market');
    }
  }

  return { linked, skipped };
}
