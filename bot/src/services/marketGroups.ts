import { prisma } from '../db';
import { oddsCache } from './oddsCache';
import { polymarketOddsCache } from './polymarketOddsCache';
import { fixtureStateCache, isTerminalStatus, type FixtureState } from './fixtureStateCache';

export interface OverlaidOutcome {
  id: string;
  label: string;
  externalId: string | null;
  impliedOdds: number;
  availableSize: number;
  lastUpdated: Date;
  canonicalKey: string | null;
}

export interface OverlaidMarket {
  id: string;
  eventId: string;
  platform: 'sx' | 'polymarket';
  externalId: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  name: string;
  startTime: Date;
  status: string;
  betType: string;
  line: number | null;
  mainLine: boolean;
  sxEventId: string | null;
  fixtureState: FixtureState | null;
  outcomes: OverlaidOutcome[];
}

export interface GroupedOutcome {
  outcomeId: string;
  label: string;
  platform: 'sx' | 'polymarket';
  externalId: string | null;
  impliedOdds: number;
  liquidityDepth: number;
  marketId: string;
  betType: string;
  line: number | null;
  mainLine: boolean;
  canonicalKey: string | null;
}

export interface MarketGroup {
  key: string;
  name: string;
  sport: string;
  league: string;
  startTime: Date;
  sxEventId: string | null;
  marketIds: string[];
  markets: OverlaidMarket[];
  outcomes: GroupedOutcome[];
  fixtureState: FixtureState | undefined;
}

// Mirrors dashboard's dashboard/src/lib/marketUtils.ts matchGroupKey.
// startTime is bucketed by 6h so SX/Poly events for the same game (which can
// have slightly different startTimes) merge while different games between the
// same teams (e.g. consecutive-day NBA series) stay separate.
export function matchGroupKey(
  name: string,
  sport: string,
  league: string,
  startTime: Date,
): string {
  const parts = name.split(' vs ');
  const teamKey = parts.length === 2 ? [...parts].sort().join('\x00') : name;
  const bucket = Math.floor(startTime.getTime() / (6 * 60 * 60 * 1000));
  return `${sport}\x01${league}\x01${teamKey}\x01${bucket}`;
}

// SX outcome externalId "<hash>:0" → isMakerBettingOutcomeOne=false → cache key "<hash>:false"
// SX outcome externalId "<hash>:1" → isMakerBettingOutcomeOne=true  → cache key "<hash>:true"
function sxLiveKey(externalId: string): string | null {
  const colonIdx = externalId.lastIndexOf(':');
  if (colonIdx === -1) return null;
  const hash = externalId.slice(0, colonIdx);
  const side = externalId.slice(colonIdx + 1);
  return `${hash}:${side === '1'}`;
}

export async function getOverlaidMarkets(): Promise<OverlaidMarket[]> {
  const markets = await prisma.market.findMany({
    where: { status: 'active', event: { status: 'active' } },
    include: { outcomes: { include: { canonicalBet: true } }, event: true },
    orderBy: { startTime: 'asc' },
  });

  const sxLive = new Map<string, number>();
  for (const e of oddsCache.getSnapshot()) {
    sxLive.set(`${e.marketHash}:${e.isMakerBettingOutcomeOne}`, e.takerOdds);
  }

  return markets.map((m) => {
    const sxEventId = m.event.sxEventId ?? null;
    const cached = sxEventId ? fixtureStateCache.get(sxEventId) : undefined;
    const fixtureState = cached && !isTerminalStatus(cached.status) ? cached : null;

    const overlaidOutcomes: OverlaidOutcome[] = m.outcomes.map((o) => {
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
      // Use event.startTime so SX/PM markets sharing an event bucket together
      // even when their own market.startTime values diverge (e.g. PM keeps a
      // midnight-ET placeholder for NBA while SX has real tipoff).
      startTime: m.event.startTime,
      status: m.status,
      betType: m.betType,
      line: m.line,
      mainLine: m.mainLine,
      sxEventId,
      fixtureState,
      outcomes: overlaidOutcomes,
    };
  });
}

export async function getMarketGroups(): Promise<MarketGroup[]> {
  const markets = await getOverlaidMarkets();
  const byKey = new Map<string, MarketGroup>();

  for (const m of markets) {
    const key = matchGroupKey(m.name, m.sport, m.league, m.startTime);
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        name: m.name,
        sport: m.sport,
        league: m.league,
        startTime: m.startTime,
        sxEventId: m.sxEventId,
        marketIds: [],
        markets: [],
        outcomes: [],
        fixtureState: undefined,
      };
      byKey.set(key, group);
    }
    group.markets.push(m);
    group.marketIds.push(m.id);
    if (!group.sxEventId && m.sxEventId) group.sxEventId = m.sxEventId;
    if (!group.fixtureState && m.fixtureState) group.fixtureState = m.fixtureState;

    for (const o of m.outcomes) {
      group.outcomes.push({
        outcomeId: o.id,
        label: o.label,
        platform: m.platform,
        externalId: o.externalId,
        impliedOdds: o.impliedOdds,
        liquidityDepth: o.availableSize,
        marketId: m.id,
        betType: m.betType,
        line: m.line,
        mainLine: m.mainLine,
        canonicalKey: o.canonicalKey,
      });
    }
  }

  return Array.from(byKey.values())
    .filter((g) => {
      if (!g.sxEventId) return true;
      const state = fixtureStateCache.get(g.sxEventId);
      return !(state && isTerminalStatus(state.status));
    })
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

export function findGroupByMarketId(groups: MarketGroup[], marketId: string): MarketGroup | undefined {
  return groups.find((g) => g.marketIds.includes(marketId));
}
