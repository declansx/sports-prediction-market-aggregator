import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config', () => ({
  config: { SX_BET_API_URL: 'https://api.sx.bet', LOG_LEVEL: 'silent', NODE_ENV: 'test' },
}));

// Shared game metadata — all three binary markets share these fields
const GAME_TIME = 1800000000;
const TEAM_ONE = 'Arsenal';
const TEAM_TWO = 'Chelsea';
const LEAGUE_ID = 29;

// Home-win binary market: outcomeOne = home team name
const MOCK_MARKET_HOME: Record<string, unknown> = {
  marketHash: '0xhome',
  outcomeOneName: TEAM_ONE,
  outcomeTwoName: 'Not Arsenal',
  teamOneName: TEAM_ONE,
  teamTwoName: TEAM_TWO,
  sportId: 5,
  sportLabel: 'Soccer',
  leagueId: LEAGUE_ID,
  type: 1,
  mainLine: true,
  gameTime: GAME_TIME,
};

// Draw binary market: outcomeOne = 'Tie'
const MOCK_MARKET_DRAW: Record<string, unknown> = {
  marketHash: '0xdraw',
  outcomeOneName: 'Tie',
  outcomeTwoName: 'Not Tie',
  teamOneName: TEAM_ONE,
  teamTwoName: TEAM_TWO,
  sportId: 5,
  sportLabel: 'Soccer',
  leagueId: LEAGUE_ID,
  type: 1,
  mainLine: true,
  gameTime: GAME_TIME,
};

// Away-win binary market: outcomeOne = away team name
const MOCK_MARKET_AWAY: Record<string, unknown> = {
  marketHash: '0xaway',
  outcomeOneName: TEAM_TWO,
  outcomeTwoName: 'Not Chelsea',
  teamOneName: TEAM_ONE,
  teamTwoName: TEAM_TWO,
  sportId: 5,
  sportLabel: 'Soccer',
  leagueId: LEAGUE_ID,
  type: 1,
  mainLine: true,
  gameTime: GAME_TIME,
};

// Double-chance market — should be filtered out (outcomeOneName contains "or")
const MOCK_MARKET_DOUBLE_CHANCE: Record<string, unknown> = {
  marketHash: '0xdoublechance',
  outcomeOneName: 'Arsenal or Draw',
  outcomeTwoName: 'Chelsea',
  teamOneName: TEAM_ONE,
  teamTwoName: TEAM_TWO,
  sportId: 5,
  sportLabel: 'Soccer',
  leagueId: LEAGUE_ID,
  type: 1,
  mainLine: true,
  gameTime: GAME_TIME,
};

// Order where maker bets outcomeTwo → taker can bet outcomeOne at 1 - makerImplied
function makeOrder(marketHash: string, makerOdds: number, isMakerBettingOutcomeOne: boolean) {
  return {
    marketHash,
    percentageOdds: String(BigInt(Math.round(makerOdds * 1e18)) * 100n),
    totalBetSize: '10000000',
    fillAmount: '0',
    isMakerBettingOutcomeOne,
  };
}

function makeFetch(responses: Array<{ ok: boolean; json: object }>) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const r = responses[call++ % responses.length];
    return Promise.resolve({ ok: r.ok, status: 200, json: () => Promise.resolve(r.json) });
  });
}

describe('fetchSxBetMarkets', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('groups all three 1X2 binary markets into one MarketQuote with six outcomes (both sides of each binary)', async () => {
    global.fetch = makeFetch([
      // /markets/active — all three binary markets + a double-chance that should be ignored
      {
        ok: true,
        json: {
          data: {
            markets: [MOCK_MARKET_HOME, MOCK_MARKET_DRAW, MOCK_MARKET_AWAY, MOCK_MARKET_DOUBLE_CHANCE],
            nextKey: '',
          },
        },
      },
      // /orders — both sides of each market
      {
        ok: true,
        json: {
          data: [
            makeOrder('0xhome', 0.48, false), // taker bets home (outcomeOne): 1 - 0.48 = 0.52
            makeOrder('0xhome', 0.55, true),  // taker bets not-home (outcomeTwo): 1 - 0.55 = 0.45
            makeOrder('0xdraw', 0.78, false), // taker bets draw: 1 - 0.78 = 0.22
            makeOrder('0xdraw', 0.80, true),  // taker bets not-draw: 1 - 0.80 = 0.20
            makeOrder('0xaway', 0.73, false), // taker bets away: 1 - 0.73 = 0.27
            makeOrder('0xaway', 0.85, true),  // taker bets not-away: 1 - 0.85 = 0.15
          ],
        },
      },
    ]);

    const { fetchSxBetMarkets } = await import('./sxbet');
    const quotes = await fetchSxBetMarkets();

    // Exactly one MarketQuote per game
    expect(quotes).toHaveLength(1);
    const q = quotes[0];

    expect(q.platform).toBe('sx');
    expect(q.externalId).toBe('0xhome'); // home-win hash as stable game ID
    expect(q.sport).toBe('Soccer');
    expect(q.name).toBe('Arsenal vs Chelsea');
    expect(q.startTime).toBeInstanceOf(Date);

    // Six outcomes: both sides of each 1X2 binary market
    expect(q.outcomes).toHaveLength(6);

    const [homeOut, notHomeOut, drawOut, notDrawOut, awayOut, notAwayOut] = q.outcomes;

    expect(homeOut.label).toBe('Arsenal');
    expect(homeOut.impliedOdds).toBeCloseTo(0.52, 4);
    expect(homeOut.externalId).toBe('0xhome:0');

    expect(notHomeOut.label).toBe('Not Arsenal');
    expect(notHomeOut.impliedOdds).toBeCloseTo(0.45, 4);
    expect(notHomeOut.externalId).toBe('0xhome:1');

    expect(drawOut.label).toBe('Draw');
    expect(drawOut.impliedOdds).toBeCloseTo(0.22, 4);
    expect(drawOut.externalId).toBe('0xdraw:0');

    expect(notDrawOut.label).toBe('Not Draw');
    expect(notDrawOut.impliedOdds).toBeCloseTo(0.20, 4);
    expect(notDrawOut.externalId).toBe('0xdraw:1');

    expect(awayOut.label).toBe('Chelsea');
    expect(awayOut.impliedOdds).toBeCloseTo(0.27, 4);
    expect(awayOut.externalId).toBe('0xaway:0');

    expect(notAwayOut.label).toBe('Not Chelsea');
    expect(notAwayOut.impliedOdds).toBeCloseTo(0.15, 4);
    expect(notAwayOut.externalId).toBe('0xaway:1');
  });

  it('produces two outcomes (home win + not home win) when draw/away binary markets are absent', async () => {
    global.fetch = makeFetch([
      {
        ok: true,
        json: { data: { markets: [MOCK_MARKET_HOME], nextKey: '' } },
      },
      {
        ok: true,
        json: { data: [makeOrder('0xhome', 0.48, false), makeOrder('0xhome', 0.55, true)] },
      },
    ]);

    const { fetchSxBetMarkets } = await import('./sxbet');
    const quotes = await fetchSxBetMarkets();

    expect(quotes).toHaveLength(1);
    expect(quotes[0].outcomes).toHaveLength(2);
    expect(quotes[0].outcomes[0].label).toBe('Arsenal');
    expect(quotes[0].outcomes[1].label).toBe('Not Arsenal');
  });

  it('uses canonical team names for labels and market name', async () => {
    const homeMarket = {
      ...MOCK_MARKET_HOME,
      marketHash: '0xbvb-home',
      outcomeOneName: 'Borussia Dortmund',
      teamOneName: 'Borussia Dortmund',
      teamTwoName: 'FC Bayern München',
    };
    const awayMarket = {
      ...MOCK_MARKET_AWAY,
      marketHash: '0xbvb-away',
      outcomeOneName: 'FC Bayern München',
      teamOneName: 'Borussia Dortmund',
      teamTwoName: 'FC Bayern München',
    };

    global.fetch = makeFetch([
      { ok: true, json: { data: { markets: [homeMarket, awayMarket], nextKey: '' } } },
      { ok: true, json: { data: [] } },
    ]);

    const { fetchSxBetMarkets } = await import('./sxbet');
    const quotes = await fetchSxBetMarkets();

    expect(quotes).toHaveLength(1);
    expect(quotes[0].name).toBe('Borussia Dortmund vs Bayern Munich');
    // home + not-home, away + not-away (no draw market in this fixture)
    expect(quotes[0].outcomes).toHaveLength(4);
    expect(quotes[0].outcomes[0].label).toBe('Borussia Dortmund');
    expect(quotes[0].outcomes[1].label).toBe('Not Borussia Dortmund');
    expect(quotes[0].outcomes[2].label).toBe('Bayern Munich');
    expect(quotes[0].outcomes[3].label).toBe('Not Bayern Munich');
  });

  it('processes game-lines markets (types 3 and 2) into separate quotes', async () => {
    const ahMarket = {
      ...MOCK_MARKET_HOME,
      marketHash: '0xah',
      type: 3,
      outcomeOneName: 'Arsenal -0.5',
      outcomeTwoName: 'Chelsea +0.5',
      line: -0.5,
      mainLine: true,
    };
    const ouMarket = {
      ...MOCK_MARKET_HOME,
      marketHash: '0xou',
      type: 2,
      outcomeOneName: 'Over 2.5',
      outcomeTwoName: 'Under 2.5',
      line: 2.5,
      mainLine: false,
    };

    global.fetch = makeFetch([
      { ok: true, json: { data: { markets: [ahMarket, ouMarket], nextKey: '' } } },
      { ok: true, json: { data: [] } }, // orders — empty, so odds will be 0
    ]);

    const { fetchSxBetMarkets } = await import('./sxbet');
    const quotes = await fetchSxBetMarkets();

    expect(quotes).toHaveLength(2);

    const ahQuote = quotes.find(q => q.betType === 'spread');
    expect(ahQuote).toBeDefined();
    expect(ahQuote?.line).toBe(-0.5);
    expect(ahQuote?.outcomes[0].label).toBe('Arsenal -0.5');
    expect(ahQuote?.outcomes[1].label).toBe('Chelsea +0.5');

    const ouQuote = quotes.find(q => q.betType === 'total');
    expect(ouQuote).toBeDefined();
    expect(ouQuote?.line).toBe(2.5);
    expect(ouQuote?.outcomes[0].label).toBe('Over 2.5');
    expect(ouQuote?.outcomes[1].label).toBe('Under 2.5');
  });

  it('returns empty array and logs warning when 0 markets returned', async () => {
    global.fetch = makeFetch([
      { ok: true, json: { data: { markets: [], nextKey: '' } } },
    ]);

    const { fetchSxBetMarkets } = await import('./sxbet');
    const quotes = await fetchSxBetMarkets();
    expect(quotes).toHaveLength(0);
  });

  it('returns markets with zero odds when orders fetch fails', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { markets: [MOCK_MARKET_HOME], nextKey: '' } }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });

    const { fetchSxBetMarkets } = await import('./sxbet');
    const quotes = await fetchSxBetMarkets();

    expect(quotes).toHaveLength(1);
    // Home-only game → 2 outcomes (home win + not home win), both zero when orders fail
    expect(quotes[0].outcomes).toHaveLength(2);
    expect(quotes[0].outcomes[0].impliedOdds).toBe(0);
    expect(quotes[0].outcomes[0].liquidityDepth.availableSize).toBe(0);
  });
});
