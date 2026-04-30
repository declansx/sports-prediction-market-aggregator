import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EPL } from '../leagues';

// EPL game event with three 1X2 sub-markets (home win, draw, away win)
// slug/seriesSlug shape matches real Polymarket Gamma API (seriesSlug is often null)
const MOCK_EVENT = {
  id: 'event-123',
  title: 'EPL: Arsenal vs. Chelsea',
  slug: 'epl-arsenal-vs-chelsea',
  seriesSlug: null,    // real API returns null — filtering must use slug, not seriesSlug
  startDate: '2026-04-15T00:00:00Z',
  markets: [
    {
      // Home-win market — Arsenal (home) appears before Chelsea
      conditionId: '0xarsenal-wins',
      question: 'Will Arsenal beat Chelsea?',
      clobTokenIds: JSON.stringify(['token-arsenal-yes', 'token-arsenal-no']),
      outcomes: JSON.stringify(['Yes', 'No']),
      outcomePrices: JSON.stringify(['0.55', '0.45']),
      active: true,
      closed: false,
      liquidity: '500',
    },
    {
      // Draw market — contains "draw"
      conditionId: '0xdraw',
      question: 'Will Arsenal vs Chelsea end in a draw?',
      clobTokenIds: JSON.stringify(['token-draw-yes', 'token-draw-no']),
      outcomes: JSON.stringify(['Yes', 'No']),
      outcomePrices: JSON.stringify(['0.25', '0.75']),
      active: true,
      closed: false,
      liquidity: '200',
    },
    {
      // Away-win market — Chelsea (away) appears before Arsenal
      conditionId: '0xchelsea-wins',
      question: 'Will Chelsea beat Arsenal?',
      clobTokenIds: JSON.stringify(['token-chelsea-yes', 'token-chelsea-no']),
      outcomes: JSON.stringify(['Yes', 'No']),
      outcomePrices: JSON.stringify(['0.30', '0.70']),
      active: true,
      closed: false,
      liquidity: '300',
    },
  ],
};

// Real CLOB API returns asks sorted descending (highest price first) — adapter must sort ascending.
const MOCK_BOOK_HOME = {
  bids: [{ price: '0.50', size: '400' }],
  asks: [
    { price: '0.57', size: '100' }, // worst ask (highest price) comes first, as in real API
    { price: '0.55', size: '250' }, // best ask (lowest price) comes last
  ],
};

// No token for home-win: "Not Arsenal" = draw or Chelsea wins
const MOCK_BOOK_NOT_HOME = {
  bids: [{ price: '0.40', size: '200' }],
  asks: [{ price: '0.45', size: '300' }],
};

const MOCK_BOOK_DRAW = {
  bids: [{ price: '0.20', size: '100' }],
  asks: [{ price: '0.25', size: '150' }],
};

// No token for draw: "Not Draw" = one team wins
const MOCK_BOOK_NOT_DRAW = {
  bids: [{ price: '0.70', size: '300' }],
  asks: [{ price: '0.75', size: '200' }],
};

const MOCK_BOOK_AWAY = {
  bids: [{ price: '0.28', size: '200' }],
  asks: [{ price: '0.30', size: '180' }],
};

// No token for away-win: "Not Chelsea" = draw or Arsenal wins
const MOCK_BOOK_NOT_AWAY = {
  bids: [{ price: '0.65', size: '250' }],
  asks: [{ price: '0.70', size: '150' }],
};

interface FeeDetails { r?: number; e?: number; to?: boolean }

interface RouteOptions {
  events?: object[];                              // Gamma /events response
  fees?: Record<string, FeeDetails | null>;       // conditionId -> fd (null = no fee details)
  books?: Record<string, object>;                 // tokenId -> book
  bookDefaultOk?: boolean;                        // unmatched book requests: true = empty 200, false = 500
}

// URL-aware fetch dispatcher. Routes by URL pattern so tests don't break when the
// adapter adds/reorders network calls (e.g. the V2 fee-info layer).
function routeFetch(opts: RouteOptions) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('/events')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(opts.events ?? []),
      });
    }
    if (url.includes('/clob-markets/')) {
      const id = decodeURIComponent(url.split('/clob-markets/')[1]);
      const fd = opts.fees?.[id];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ c: id, fd: fd ?? null }),
      });
    }
    if (url.includes('/book?token_id=')) {
      const tokenId = decodeURIComponent(url.split('token_id=')[1]);
      const book = opts.books?.[tokenId];
      if (book) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(book) });
      }
      if (opts.bookDefaultOk === false) {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ bids: [], asks: [] }) });
    }
    throw new Error(`unmocked fetch: ${url}`);
  });
}

const ALL_BOOKS = {
  'token-arsenal-yes': MOCK_BOOK_HOME,
  'token-arsenal-no': MOCK_BOOK_NOT_HOME,
  'token-draw-yes': MOCK_BOOK_DRAW,
  'token-draw-no': MOCK_BOOK_NOT_DRAW,
  'token-chelsea-yes': MOCK_BOOK_AWAY,
  'token-chelsea-no': MOCK_BOOK_NOT_AWAY,
};

describe('fetchPolymarketMarkets', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('emits one MarketQuote per game with six outcomes (both sides of each 1X2 binary)', async () => {
    global.fetch = routeFetch({
      events: [MOCK_EVENT],
      books: ALL_BOOKS,
    }) as unknown as typeof fetch;

    const { fetchPolymarketMarkets } = await import('./polymarket');
    const quotes = await fetchPolymarketMarkets(EPL);

    expect(quotes).toHaveLength(1);
    const q = quotes[0];

    expect(q.platform).toBe('polymarket');
    expect(q.externalId).toBe('event-123');
    expect(q.sport).toBe('Soccer');
    expect(q.name).toBe('Arsenal vs Chelsea');
    expect(q.startTime).toBeInstanceOf(Date);
    expect(q.outcomes).toHaveLength(6);

    // All fee-adjusted: every sports market uses SPORTS_FEE_RATE = 0.03.
    // applyFee(p, 0.03) = p + 0.03 * p * (1 - p)

    // Home Win (Yes token) — 0.55 + 0.03*0.55*0.45 = 0.557425
    const home = q.outcomes[0];
    expect(home.label).toBe('Arsenal');
    expect(home.externalId).toBe('token-arsenal-yes');
    expect(home.impliedOdds).toBeCloseTo(0.557425, 4);
    // availableSize is dollar-denominated (size * price) so Poly liquidity is
    // comparable to SX's dollar-denominated liquidity. Asks: 250@0.55 + 100@0.57 = 137.5 + 57 = 194.5.
    expect(home.liquidityDepth.availableSize).toBeCloseTo(194.5, 1);

    // Not Home Win (No token) — 0.45 + 0.03*0.45*0.55 = 0.457425
    const notHome = q.outcomes[1];
    expect(notHome.label).toBe('Not Arsenal');
    expect(notHome.externalId).toBe('token-arsenal-no');
    expect(notHome.impliedOdds).toBeCloseTo(0.457425, 4);
    expect(notHome.liquidityDepth.availableSize).toBeCloseTo(300 * 0.45, 1);

    // Draw (Yes token) — 0.25 + 0.03*0.25*0.75 = 0.255625
    const draw = q.outcomes[2];
    expect(draw.label).toBe('Draw');
    expect(draw.externalId).toBe('token-draw-yes');
    expect(draw.impliedOdds).toBeCloseTo(0.255625, 4);
    expect(draw.liquidityDepth.availableSize).toBeCloseTo(150 * 0.25, 1);

    // Not Draw (No token) — 0.75 + 0.03*0.75*0.25 = 0.755625
    const notDraw = q.outcomes[3];
    expect(notDraw.label).toBe('Not Draw');
    expect(notDraw.externalId).toBe('token-draw-no');
    expect(notDraw.impliedOdds).toBeCloseTo(0.755625, 4);
    expect(notDraw.liquidityDepth.availableSize).toBeCloseTo(200 * 0.75, 1);

    // Away Win (Yes token) — 0.30 + 0.03*0.30*0.70 = 0.3063
    const away = q.outcomes[4];
    expect(away.label).toBe('Chelsea');
    expect(away.externalId).toBe('token-chelsea-yes');
    expect(away.impliedOdds).toBeCloseTo(0.3063, 4);
    expect(away.liquidityDepth.availableSize).toBeCloseTo(180 * 0.30, 1);

    // Not Away Win (No token) — 0.70 + 0.03*0.70*0.30 = 0.7063
    const notAway = q.outcomes[5];
    expect(notAway.label).toBe('Not Chelsea');
    expect(notAway.externalId).toBe('token-chelsea-no');
    expect(notAway.impliedOdds).toBeCloseTo(0.7063, 4);
    expect(notAway.liquidityDepth.availableSize).toBeCloseTo(150 * 0.70, 1);
  });

  it('produces two outcomes (home win + not home win) when draw/away sub-markets are absent', async () => {
    const homeOnlyEvent = {
      ...MOCK_EVENT,
      id: 'event-homeonly',
      markets: [MOCK_EVENT.markets[0]], // only home win
    };

    global.fetch = routeFetch({
      events: [homeOnlyEvent],
      books: ALL_BOOKS,
    }) as unknown as typeof fetch;

    const { fetchPolymarketMarkets } = await import('./polymarket');
    const quotes = await fetchPolymarketMarkets(EPL);

    expect(quotes).toHaveLength(1);
    expect(quotes[0].outcomes).toHaveLength(2);
    expect(quotes[0].outcomes[0].label).toBe('Arsenal');
    expect(quotes[0].outcomes[1].label).toBe('Not Arsenal');
  });

  it('uses canonical team names', async () => {
    const manCityEvent = {
      ...MOCK_EVENT,
      id: 'event-456',
      title: 'EPL: Manchester City vs. Wolverhampton Wanderers',
      markets: [
        {
          conditionId: '0xcity-wins',
          question: 'Will Manchester City beat Wolverhampton Wanderers?',
          clobTokenIds: JSON.stringify(['token-city-yes', 'token-city-no']),
          outcomes: JSON.stringify(['Yes', 'No']),
          outcomePrices: JSON.stringify(['0.70', '0.30']),
          active: true,
          closed: false,
          liquidity: '1000',
        },
      ],
    };

    global.fetch = routeFetch({
      events: [manCityEvent],
      books: { 'token-city-yes': MOCK_BOOK_HOME, 'token-city-no': MOCK_BOOK_NOT_HOME },
    }) as unknown as typeof fetch;

    const { fetchPolymarketMarkets } = await import('./polymarket');
    const quotes = await fetchPolymarketMarkets(EPL);

    expect(quotes).toHaveLength(1);
    expect(quotes[0].name).toBe('Manchester City vs Wolverhampton');
    expect(quotes[0].outcomes[0].label).toBe('Manchester City');
    expect(quotes[0].outcomes[1].label).toBe('Not Manchester City');
  });

  it('skips events whose slug does not match the league prefix', async () => {
    // slug field is what we filter on — seriesSlug is often null in the real API
    const nonLeagueEvent = { ...MOCK_EVENT, id: 'event-999', slug: 'mls-portland-vs-seattle', title: 'Portland vs Seattle' };

    global.fetch = routeFetch({ events: [nonLeagueEvent] }) as unknown as typeof fetch;

    const { fetchPolymarketMarkets } = await import('./polymarket');
    const quotes = await fetchPolymarketMarkets(EPL);
    expect(quotes).toHaveLength(0);
  });

  it('finds events when seriesSlug is null but slug matches (regression: real Polymarket API shape)', async () => {
    // Real Polymarket API returns seriesSlug: null for most events.
    // Bug: old code checked e.seriesSlug?.startsWith(...) which was always falsy → 0 quotes.
    // Fix: filter by e.slug which is always populated.
    const nullSeriesSlugEvent = {
      ...MOCK_EVENT,
      id: 'event-ucl-regression',
      slug: 'epl-arsenal-vs-chelsea',
      seriesSlug: null,  // exactly as returned by the real API
    };

    global.fetch = routeFetch({
      events: [nullSeriesSlugEvent],
      books: ALL_BOOKS,
    }) as unknown as typeof fetch;

    const { fetchPolymarketMarkets } = await import('./polymarket');
    const quotes = await fetchPolymarketMarkets(EPL);

    // With the bug: quotes.length === 0 (seriesSlug filter blocked everything)
    // After fix: quotes.length === 1
    expect(quotes).toHaveLength(1);
    expect(quotes[0].outcomes).toHaveLength(6);
  });

  it('skips events where no home-win sub-market is found', async () => {
    const drawOnlyEvent = {
      ...MOCK_EVENT,
      id: 'event-888',
      markets: [MOCK_EVENT.markets[1]], // only the draw market
    };

    global.fetch = routeFetch({ events: [drawOnlyEvent] }) as unknown as typeof fetch;

    const { fetchPolymarketMarkets } = await import('./polymarket');
    const quotes = await fetchPolymarketMarkets(EPL);
    expect(quotes).toHaveLength(0);
  });

  it('uses fallback prices when CLOB book fetch fails', async () => {
    global.fetch = routeFetch({
      events: [MOCK_EVENT],
      bookDefaultOk: false, // every book request returns 500
    }) as unknown as typeof fetch;

    const { fetchPolymarketMarkets } = await import('./polymarket');
    const quotes = await fetchPolymarketMarkets(EPL);

    expect(quotes).toHaveLength(1);
    expect(quotes[0].outcomes).toHaveLength(6);
    // Fallback prices from outcomePrices[0/1] for each sub-market, fee-adjusted.
    expect(quotes[0].outcomes[0].impliedOdds).toBeCloseTo(0.557425, 4); // Arsenal
    expect(quotes[0].outcomes[0].liquidityDepth.topLevels).toHaveLength(0);
    expect(quotes[0].outcomes[1].impliedOdds).toBeCloseTo(0.457425, 4); // Not Arsenal
    expect(quotes[0].outcomes[2].impliedOdds).toBeCloseTo(0.255625, 4); // Draw
    expect(quotes[0].outcomes[3].impliedOdds).toBeCloseTo(0.755625, 4); // Not Draw
    expect(quotes[0].outcomes[4].impliedOdds).toBeCloseTo(0.3063, 4);   // Chelsea
    expect(quotes[0].outcomes[5].impliedOdds).toBeCloseTo(0.7063, 4);   // Not Chelsea
  });

  it('returns empty array when Gamma returns 0 events', async () => {
    global.fetch = routeFetch({ events: [] }) as unknown as typeof fetch;

    const { fetchPolymarketMarkets } = await import('./polymarket');
    const quotes = await fetchPolymarketMarkets(EPL);
    expect(quotes).toHaveLength(0);
  });

  it('applies hardcoded sports fee rate (0.03) to implied odds and topLevels', async () => {
    // SPORTS_FEE_RATE = 0.03 stamped on every Polymarket outcome — no per-market fetch.
    // applyFee(0.55, 0.03) = 0.55 + 0.03 * 0.55 * 0.45 = 0.557425
    // applyFee(0.45, 0.03) = 0.45 + 0.03 * 0.45 * 0.55 = 0.457425
    const event = {
      ...MOCK_EVENT,
      id: 'event-fee-test',
      markets: [MOCK_EVENT.markets[0]], // only home-win
    };

    global.fetch = routeFetch({
      events: [event],
      books: { 'token-arsenal-yes': MOCK_BOOK_HOME, 'token-arsenal-no': MOCK_BOOK_NOT_HOME },
    }) as unknown as typeof fetch;

    const { fetchPolymarketMarkets } = await import('./polymarket');
    const quotes = await fetchPolymarketMarkets(EPL);

    expect(quotes).toHaveLength(1);
    expect(quotes[0].outcomes).toHaveLength(2);

    expect(quotes[0].outcomes[0].impliedOdds).toBeCloseTo(0.557425, 4);
    expect(quotes[0].outcomes[1].impliedOdds).toBeCloseTo(0.457425, 4);

    // topLevels prices also reflect the fee
    const homeTopLevel = quotes[0].outcomes[0].liquidityDepth.topLevels[0];
    expect(homeTopLevel.odds).toBeCloseTo(0.557425, 4);
  });

  it('parses total goals events into separate total quotes with correct line values and labels', async () => {
    const goalsEvent = {
      id: 'event-goals',
      title: 'EPL: Arsenal vs. Chelsea - More Markets',
      slug: 'epl-arsenal-vs-chelsea-more-markets',
      seriesSlug: null,
      startDate: '2026-04-15T00:00:00Z',
      endDate: '2026-04-15T22:00:00Z',
      markets: [
        {
          conditionId: '0xover25',
          question: 'Total: Over 2.5',
          clobTokenIds: JSON.stringify(['token-over25', 'token-under25']),
          outcomes: JSON.stringify(['Over 2.5', 'Under 2.5']),
          outcomePrices: JSON.stringify(['0.60', '0.40']),
          active: true,
          closed: false,
          liquidity: '500',
          sportsMarketType: 'totals',
          line: 2.5,
        },
        {
          conditionId: '0xover35',
          question: 'Total: Over 3.5',
          clobTokenIds: JSON.stringify(['token-over35', 'token-under35']),
          outcomes: JSON.stringify(['Over 3.5', 'Under 3.5']),
          outcomePrices: JSON.stringify(['0.25', '0.75']),
          active: true,
          closed: false,
          liquidity: '300',
          sportsMarketType: 'totals',
          line: 3.5,
        },
      ],
    };

    global.fetch = routeFetch({
      events: [goalsEvent],
      books: {
        'token-over25': MOCK_BOOK_HOME,
        'token-under25': MOCK_BOOK_NOT_HOME,
        'token-over35': MOCK_BOOK_HOME,
        'token-under35': MOCK_BOOK_NOT_HOME,
      },
    }) as unknown as typeof fetch;

    const { fetchPolymarketMarkets } = await import('./polymarket');
    const quotes = await fetchPolymarketMarkets(EPL);

    expect(quotes).toHaveLength(2);

    const over25 = quotes.find((q) => q.line === 2.5);
    expect(over25).toBeDefined();
    expect(over25?.betType).toBe('total');
    expect(over25?.mainLine).toBe(false);
    expect(over25?.name).toBe('Arsenal vs Chelsea');
    expect(over25?.platform).toBe('polymarket');
    expect(over25?.externalId).toBe('0xover25');
    expect(over25?.outcomes[0].label).toBe('Over 2.5');
    expect(over25?.outcomes[1].label).toBe('Under 2.5');
    expect(over25?.outcomes[0].externalId).toBe('token-over25');
    expect(over25?.outcomes[1].externalId).toBe('token-under25');

    const over35 = quotes.find((q) => q.line === 3.5);
    expect(over35).toBeDefined();
    expect(over35?.betType).toBe('total');
    expect(over35?.outcomes[0].label).toBe('Over 3.5');
    expect(over35?.outcomes[1].label).toBe('Under 3.5');
  });

  it('appends line value to bare Over/Under labels (regression: real API returns "Over" not "Over 2.5")', async () => {
    const bareLabelsEvent = {
      id: 'event-bare',
      title: 'EPL: Arsenal vs. Chelsea - More Markets',
      slug: 'epl-arsenal-vs-chelsea-more-markets',
      seriesSlug: null,
      startDate: '2026-04-15T00:00:00Z',
      endDate: '2026-04-15T22:00:00Z',
      markets: [
        {
          conditionId: '0xbare25',
          question: 'Total: Over 2.5',
          clobTokenIds: JSON.stringify(['token-bare-over', 'token-bare-under']),
          outcomes: JSON.stringify(['Over', 'Under']), // bare labels — real API shape for some markets
          outcomePrices: JSON.stringify(['0.55', '0.45']),
          active: true,
          closed: false,
          liquidity: '400',
          sportsMarketType: 'totals',
          line: 2.5,
        },
      ],
    };

    global.fetch = routeFetch({
      events: [bareLabelsEvent],
      books: { 'token-bare-over': MOCK_BOOK_HOME, 'token-bare-under': MOCK_BOOK_NOT_HOME },
    }) as unknown as typeof fetch;

    const { fetchPolymarketMarkets } = await import('./polymarket');
    const quotes = await fetchPolymarketMarkets(EPL);

    expect(quotes).toHaveLength(1);
    expect(quotes[0].outcomes[0].label).toBe('Over 2.5');
    expect(quotes[0].outcomes[1].label).toBe('Under 2.5');
  });

  it('parses spread markets using sportsMarketType and line fields (real API structure)', async () => {
    // Mirrors the actual Polymarket "More Markets" API response for Copa Libertadores
    const moreMarketsEvent = {
      id: 'event-more',
      title: 'CA Peñarol vs. CA Platense - More Markets',
      slug: 'epl-pen-cp-2026-04-16-more-markets',
      seriesSlug: null,
      startDate: '2026-03-28T13:13:36Z',
      endDate: '2026-04-17T00:30:00Z',
      markets: [
        {
          conditionId: '0xspread-home',
          question: 'Spread: CA Peñarol (-1.5)',
          clobTokenIds: JSON.stringify(['token-pen-yes', 'token-pen-no']),
          outcomes: JSON.stringify(['CA Peñarol', 'CA Platense']),
          outcomePrices: JSON.stringify(['0.195', '0.805']),
          active: true,
          closed: false,
          liquidity: '29487',
          sportsMarketType: 'spreads',
          line: -1.5,
        },
      ],
    };

    global.fetch = routeFetch({
      events: [moreMarketsEvent],
      fees: { '0xspread-home': { r: 0.03, e: 1, to: true } },
      books: { 'token-pen-yes': MOCK_BOOK_HOME, 'token-pen-no': MOCK_BOOK_NOT_HOME },
    }) as unknown as typeof fetch;

    const { fetchPolymarketMarkets } = await import('./polymarket');
    const quotes = await fetchPolymarketMarkets(EPL);

    expect(quotes).toHaveLength(1);
    const q = quotes[0];
    expect(q.betType).toBe('spread');
    expect(q.line).toBe(-1.5);
    expect(q.mainLine).toBe(false);
    expect(q.platform).toBe('polymarket');
    expect(q.externalId).toBe('0xspread-home');
    // Team names should be passed through canonicalTeamName
    expect(q.outcomes[0].label).toContain('-1.5');
    expect(q.outcomes[1].label).toContain('+1.5');
    expect(q.outcomes[0].externalId).toBe('token-pen-yes');
    expect(q.outcomes[1].externalId).toBe('token-pen-no');
  });

  it('ignores game-lines events with unrecognised suffixes (e.g. first half, player props)', async () => {
    const firstHalfEvent = {
      id: 'event-firsthalf',
      title: 'EPL: Arsenal vs. Chelsea - First Half Winner',
      slug: 'epl-arsenal-vs-chelsea-first-half',
      seriesSlug: null,
      startDate: '2026-04-15T00:00:00Z',
      markets: [
        {
          conditionId: '0xfh',
          question: 'Will Arsenal win the first half?',
          clobTokenIds: JSON.stringify(['token-fh-yes', 'token-fh-no']),
          outcomes: JSON.stringify(['Yes', 'No']),
          outcomePrices: JSON.stringify(['0.50', '0.50']),
          active: true,
          closed: false,
          liquidity: '100',
        },
      ],
    };

    global.fetch = routeFetch({ events: [firstHalfEvent] }) as unknown as typeof fetch;

    const { fetchPolymarketMarkets } = await import('./polymarket');
    const quotes = await fetchPolymarketMarkets(EPL);
    // No home-win match event → no 1X2 quotes; first-half event suffix not recognised → no game-lines quotes
    expect(quotes).toHaveLength(0);
  });

  it('processes both 1X2 match events and goals events in the same fetch', async () => {
    const goalsEvent = {
      id: 'event-goals-combined',
      title: 'EPL: Arsenal vs. Chelsea - More Markets',
      slug: 'epl-arsenal-vs-chelsea-more-markets',
      seriesSlug: null,
      startDate: '2026-04-15T00:00:00Z',
      endDate: '2026-04-15T22:00:00Z',
      markets: [
        {
          conditionId: '0xover25-b',
          question: 'Total: Over 2.5',
          clobTokenIds: JSON.stringify(['token-b-over', 'token-b-under']),
          outcomes: JSON.stringify(['Over 2.5', 'Under 2.5']),
          outcomePrices: JSON.stringify(['0.55', '0.45']),
          active: true,
          closed: false,
          liquidity: '400',
          sportsMarketType: 'totals',
          line: 2.5,
        },
      ],
    };

    global.fetch = routeFetch({
      events: [MOCK_EVENT, goalsEvent],
      books: {
        ...ALL_BOOKS,
        'token-b-over': MOCK_BOOK_HOME,
        'token-b-under': MOCK_BOOK_NOT_HOME,
      },
    }) as unknown as typeof fetch;

    const { fetchPolymarketMarkets } = await import('./polymarket');
    const quotes = await fetchPolymarketMarkets(EPL);

    // 1 x 1X2 quote + 1 x total quote
    expect(quotes).toHaveLength(2);
    const x2 = quotes.find((q) => q.betType === '1x2');
    const total = quotes.find((q) => q.betType === 'total');
    expect(x2).toBeDefined();
    expect(total).toBeDefined();
    expect(total?.line).toBe(2.5);
    expect(total?.outcomes[0].label).toBe('Over 2.5');
  });
});
