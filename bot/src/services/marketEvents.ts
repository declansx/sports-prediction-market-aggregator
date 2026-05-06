import { EventEmitter } from 'events';
import { prisma } from '../db';
import { oddsCache } from './oddsCache';
import { polymarketOddsCache } from './polymarketOddsCache';
import { fixtureStateCache, isTerminalStatus } from './fixtureStateCache';
import type { OverlaidMarket, OverlaidOutcome } from './marketGroups';
import { createLogger } from '../logger';

const log = createLogger('marketEvents');

class MarketEvents extends EventEmitter {}

export const marketEvents = new MarketEvents();

function sxLiveKey(externalId: string): string | null {
  const colonIdx = externalId.lastIndexOf(':');
  if (colonIdx === -1) return null;
  const hash = externalId.slice(0, colonIdx);
  const side = externalId.slice(colonIdx + 1);
  return `${hash}:${side === '1'}`;
}

// Mirrors getOverlaidMarkets() shape for a single market id.
// Returns null if the market or its event isn't in 'active' state — the
// dashboard treats absence as "remove from list".
export async function buildOverlaidMarket(marketId: string): Promise<OverlaidMarket | null> {
  const m = await prisma.market.findUnique({
    where: { id: marketId },
    include: { outcomes: { include: { canonicalBet: true } }, event: true },
  });
  if (!m || m.status !== 'active' || m.event.status !== 'active') return null;

  const sxLive = new Map<string, number>();
  if (m.platform === 'sx') {
    for (const e of oddsCache.getSnapshot()) {
      sxLive.set(`${e.marketHash}:${e.isMakerBettingOutcomeOne}`, e.takerOdds);
    }
  }

  const sxEventId = m.event.sxEventId ?? null;
  const cached = sxEventId ? fixtureStateCache.get(sxEventId) : undefined;
  const fixtureState = cached && !isTerminalStatus(cached.status) ? cached : null;

  const outcomes: OverlaidOutcome[] = m.outcomes.map((o) => {
    let impliedOdds = o.currentOdds;
    if (m.platform === 'sx' && o.externalId) {
      const key = sxLiveKey(o.externalId);
      if (key) {
        const live = sxLive.get(key);
        if (live !== undefined) impliedOdds = live;
      }
    } else if (m.platform === 'polymarket' && o.externalId) {
      const live = polymarketOddsCache.getTakerOdds(o.externalId);
      if (live !== undefined) impliedOdds = live;
    }
    return {
      id: o.id,
      label: o.label,
      externalId: o.externalId ?? null,
      impliedOdds,
      availableSize: o.liquidityDepth,
      lastUpdated: o.lastUpdated,
      canonicalKey: o.canonicalBet?.key ?? null,
    };
  });

  return {
    id: m.id,
    eventId: m.eventId,
    platform: m.platform as 'sx' | 'polymarket',
    externalId: m.externalId,
    sport: m.event.sport,
    league: m.event.league,
    homeTeam: m.event.homeTeam,
    awayTeam: m.event.awayTeam,
    name: `${m.event.homeTeam} vs ${m.event.awayTeam}`,
    startTime: m.event.startTime,
    status: m.status,
    betType: m.betType,
    line: m.line,
    mainLine: m.mainLine,
    sxEventId,
    fixtureState,
    outcomes,
  };
}

/**
 * Fire a marketUpsert event for the given market id. Safe to call from
 * anywhere — the relay listens and forwards to dashboard clients.
 *
 * Uses fire-and-forget on the build promise so call sites don't have to
 * await. Errors are logged but never thrown.
 */
export function emitMarketUpsert(marketId: string): void {
  buildOverlaidMarket(marketId)
    .then((market) => {
      if (!market) return; // market is no longer active — emitMarketRemoved handles that path
      marketEvents.emit('upsert', market);
    })
    .catch((err) => {
      log.error({ err, marketId }, 'failed to build overlaid market for upsert event');
    });
}

export function emitMarketRemoved(marketId: string): void {
  marketEvents.emit('removed', { id: marketId });
}
