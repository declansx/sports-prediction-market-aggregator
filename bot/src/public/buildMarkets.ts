/**
 * Stateless, DB-free reconstruction of the `/api/markets` response.
 *
 * The bot's normal path persists every quote through `upsertMarkets` (event
 * linking, canonical-bet linking, cross-platform twin absorption) and then
 * reads it back via `getOverlaidMarkets`. The DB is doing two jobs there:
 * (1) carrying derived match/odds state across 30s sync cycles, and (2)
 * matching SX-market-X to Poly-market-Y so the dashboard can compare them.
 *
 * For the read-only public dashboard we don't need the cross-cycle state —
 * we fetch both platforms fresh on demand. So all the persistence-only
 * complexity (rename detection, home/away ping-pong guards, twin absorption,
 * doubleheader safeguards) evaporates. What remains is a single in-memory
 * pass: group quotes into events, resolve home/away (SX authoritative),
 * canonicalize every outcome against that assignment, and emit the same
 * payload shape `routes/markets.ts` produces.
 *
 * The grouping deliberately mirrors the dashboard's own `matchGroupKey`
 * (sorted team-pair + 6h start-time bucket) so cross-platform markets land in
 * the same event even when the two platforms disagree on home/away order or
 * report slightly different kick-off times.
 */
import { canonicalize } from '../router/canonicalize';
import { canonicalTeamName } from '../adapters/teamNames';
import type { MarketQuote, Platform } from '../types';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export interface PublicOutcome {
  id: string;
  label: string;
  platform: Platform;
  externalId?: string;
  impliedOdds: number;
  availableSize: number;
  lastUpdated: string;
  canonicalKey: string | null;
}

export interface PublicMarket {
  id: string;
  eventId: string;
  platform: Platform;
  externalId: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  name: string;
  startTime: string;
  status: string;
  betType: string;
  line: number | null;
  mainLine: boolean;
  sxEventId: string | null;
  fixtureState: null;
  outcomes: PublicOutcome[];
}

/**
 * Event-grouping key. Mirrors the dashboard's `matchGroupKey`: order-independent
 * team pair + 6-hour start-time bucket, scoped to sport + league. Two quotes
 * with this key are treated as the same game regardless of which platform calls
 * which team "home" or how their reported start times drift.
 */
function eventKeyFor(home: string, away: string, sport: string, league: string, startTime: Date): string {
  const teamKey = [home, away].sort().join('\x00');
  const bucket = Math.floor(startTime.getTime() / SIX_HOURS_MS);
  return `${sport}\x01${league}\x01${teamKey}\x01${bucket}`;
}

interface EventAgg {
  key: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  startTime: Date;
  sxEventId: string | null;
  /** Original quotes belonging to this event, in arrival order. */
  quotes: MarketQuote[];
  /** True once an SX quote has set the authoritative home/away + startTime. */
  resolvedBySx: boolean;
}

/**
 * Build the public `/api/markets` payload from freshly-fetched platform quotes.
 *
 * @param sxQuotes   Output of `fetchSxBetMarkets` across all leagues.
 * @param polyQuotes Output of `fetchPolymarketMarkets` across all leagues.
 * @param now        Timestamp stamped on every outcome's `lastUpdated`
 *                   (injectable for deterministic tests).
 */
export function buildOverlaidMarkets(
  sxQuotes: MarketQuote[],
  polyQuotes: MarketQuote[],
  now: Date = new Date(),
): PublicMarket[] {
  // Pass 1 — group all quotes into events and resolve home/away + startTime.
  // SX is authoritative for home/away (team1 is invariantly the home team) and
  // for start time (Polymarket sometimes reports a midnight-ET placeholder), so
  // an SX quote overrides whatever a Poly quote established for the same event.
  const events = new Map<string, EventAgg>();

  const ingest = (quote: MarketQuote) => {
    if (!quote.homeTeam || !quote.awayTeam) return;
    const home = canonicalTeamName(quote.homeTeam, quote.sport);
    const away = canonicalTeamName(quote.awayTeam, quote.sport);
    const key = eventKeyFor(home, away, quote.sport, quote.league, quote.startTime);
    const isSx = quote.platform === 'sx';

    let agg = events.get(key);
    if (!agg) {
      agg = {
        key,
        sport: quote.sport,
        league: quote.league,
        home,
        away,
        startTime: quote.startTime,
        sxEventId: quote.sxEventId ?? null,
        quotes: [],
        resolvedBySx: isSx,
      };
      events.set(key, agg);
    } else if (isSx && !agg.resolvedBySx) {
      // First SX quote for this event — adopt its authoritative assignment.
      agg.home = home;
      agg.away = away;
      agg.startTime = quote.startTime;
      agg.resolvedBySx = true;
    }
    if (isSx && quote.sxEventId && !agg.sxEventId) agg.sxEventId = quote.sxEventId;
    agg.quotes.push(quote);
  };

  // SX first so events resolve to the authoritative home/away before Poly lands.
  for (const q of sxQuotes) ingest(q);
  for (const q of polyQuotes) ingest(q);

  // Pass 2 — emit one PublicMarket per quote, canonicalizing every outcome
  // against the event's resolved home/away. Name + startTime are stamped from
  // the event (not the quote) so SX/Poly markets for the same game share them.
  const lastUpdated = now.toISOString();
  const out: PublicMarket[] = [];

  for (const agg of events.values()) {
    const name = `${agg.home} vs ${agg.away}`;
    const startTime = agg.startTime.toISOString();

    for (const quote of agg.quotes) {
      const outcomes: PublicOutcome[] = quote.outcomes.map((o) => {
        const result = canonicalize(o.label, quote.betType, agg.home, agg.away);
        return {
          id: `${quote.platform}:${quote.externalId}:${o.label}`,
          label: o.label,
          platform: quote.platform,
          externalId: o.externalId ?? undefined,
          impliedOdds: o.impliedOdds,
          availableSize: o.liquidityDepth.availableSize,
          lastUpdated,
          canonicalKey: result.parts?.key ?? null,
        };
      });

      out.push({
        id: `${quote.platform}:${quote.externalId}`,
        eventId: agg.key,
        platform: quote.platform,
        externalId: quote.externalId,
        sport: agg.sport,
        league: agg.league,
        homeTeam: agg.home,
        awayTeam: agg.away,
        name,
        startTime,
        status: 'active',
        betType: quote.betType,
        line: quote.line ?? null,
        mainLine: quote.mainLine ?? true,
        sxEventId: agg.sxEventId,
        fixtureState: null,
        outcomes,
      });
    }
  }

  return out;
}
