export interface LeagueConfig {
  /** Display name used in logs and DB. */
  name: string;
  /** Sport label stored on MarketQuote. */
  sport: string;
  /** False for American sports (NBA/MLB/NHL) — gates 1x2 fetching in adapters. */
  hasDraw: boolean;
  sxbet: {
    /** SX Bet /markets/active leagueId. */
    leagueId: number;
    /** SX Bet /teams sportId — used by sync-teams to pull the global team pool. Defaults to 5 (soccer). */
    sportId?: number;
  };
  /** Omit for SX Bet-only leagues (e.g. NHL during playoffs). */
  polymarket?: {
    /** Gamma API series_id — events fetched via ?series_id=X. */
    seriesId: number;
    /**
     * Title ordering convention from Polymarket /sports endpoint.
     * 'home' = "HomeTeam vs AwayTeam" (soccer): home is first in title.
     * 'away' = "AwayTeam vs HomeTeam" (NBA/MLB/NHL/NFL): away is first.
     * Drives the home/away assignment in the polymarket adapter so it
     * matches SX's invariant (team1 = home).
     */
    titleOrdering: 'home' | 'away';
  };
}

export const EPL: LeagueConfig = {
  name: 'EPL',
  sport: 'Soccer',
  hasDraw: true,
  sxbet: { leagueId: 29 },
  polymarket: { seriesId: 10188, titleOrdering: 'home' },
};

export const UCL: LeagueConfig = {
  name: 'UCL',
  sport: 'Soccer',
  hasDraw: true,
  sxbet: { leagueId: 30 },
  polymarket: { seriesId: 10204, titleOrdering: 'home' },
};

export const UEL: LeagueConfig = {
  name: 'UEL',
  sport: 'Soccer',
  hasDraw: true,
  sxbet: { leagueId: 31 },
  polymarket: { seriesId: 10209, titleOrdering: 'home' },
};

export const COPA_LIBERTADORES: LeagueConfig = {
  name: 'Copa Libertadores',
  sport: 'Soccer',
  hasDraw: true,
  sxbet: { leagueId: 1631 },
  polymarket: { seriesId: 10289, titleOrdering: 'home' },
};

export const LA_LIGA: LeagueConfig = {
  name: 'La Liga',
  sport: 'Soccer',
  hasDraw: true,
  sxbet: { leagueId: 1114 },
  polymarket: { seriesId: 10193, titleOrdering: 'home' },
};

export const SERIE_A: LeagueConfig = {
  name: 'Serie A',
  sport: 'Soccer',
  hasDraw: true,
  sxbet: { leagueId: 1113 },
  polymarket: { seriesId: 10203, titleOrdering: 'home' },
};

export const BUNDESLIGA: LeagueConfig = {
  name: 'Bundesliga',
  sport: 'Soccer',
  hasDraw: true,
  sxbet: { leagueId: 244 },
  polymarket: { seriesId: 10194, titleOrdering: 'home' },
};

export const EREDIVISIE: LeagueConfig = {
  name: 'Eredivisie',
  sport: 'Soccer',
  hasDraw: true,
  sxbet: { leagueId: 1330 },
  polymarket: { seriesId: 10286, titleOrdering: 'home' },
};

export const LIGUE_1: LeagueConfig = {
  name: 'Ligue 1',
  sport: 'Soccer',
  hasDraw: true,
  sxbet: { leagueId: 1112 },
  polymarket: { seriesId: 10195, titleOrdering: 'home' },
};

export const WORLD_CUP: LeagueConfig = {
  name: 'World Cup',
  sport: 'Soccer',
  hasDraw: true,
  // SX league 1715 = "FIFA World Cup". Soccer (default sportId 5), type-1 markets
  // carry the Tie outcome, live-enabled.
  sxbet: { leagueId: 1715 },
  // Gamma series 11433 (sport slug "fifwc"). National-team titles list HOME first,
  // like the club soccer leagues.
  polymarket: { seriesId: 11433, titleOrdering: 'home' },
};

export const NBA: LeagueConfig = {
  name: 'NBA',
  sport: 'Basketball',
  hasDraw: false,
  sxbet: { leagueId: 1, sportId: 1 },
  // seriesId 10345 = NBA daily games series — scopes to individual game markets only,
  // excluding playoff series/special-event markets that share the 'nba' tag slug.
  // Polymarket NBA titles list AWAY first ("Visitor at Home").
  polymarket: { seriesId: 10345, titleOrdering: 'away' },
};

export const MLB: LeagueConfig = {
  name: 'MLB',
  sport: 'Baseball',
  hasDraw: false,
  sxbet: { leagueId: 171, sportId: 3 },
  // seriesId 3 = MLB daily games series. Polymarket MLB titles list AWAY first.
  polymarket: { seriesId: 3, titleOrdering: 'away' },
};

export const NHL: LeagueConfig = {
  name: 'NHL',
  sport: 'Hockey',
  hasDraw: false,
  sxbet: { leagueId: 3, sportId: 2 },
  // seriesId 10346 = NHL daily games series. Polymarket NHL titles list AWAY first.
  polymarket: { seriesId: 10346, titleOrdering: 'away' },
};

/** The league the bot is currently tracking. Change this to switch leagues. */
export const ACTIVE_LEAGUE: LeagueConfig = UCL;
