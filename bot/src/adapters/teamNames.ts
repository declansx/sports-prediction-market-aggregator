import { GENERATED_CANONICAL } from './teamNamesGenerated';

// Hand-written entries for EPL, UCL, and any overrides.
// Auto-generated per-league entries live in teamNamesGenerated.ts (run `npm run sync-teams` to update).
// MANUAL entries take precedence over auto-generated ones.
const MANUAL: Record<string, string> = {
  'arsenal': 'Arsenal',
  'arsenal fc': 'Arsenal',
  'aston villa': 'Aston Villa',
  'aston villa fc': 'Aston Villa',
  'afc bournemouth': 'Bournemouth',
  'bournemouth': 'Bournemouth',
  'bournemouth fc': 'Bournemouth',
  'brentford': 'Brentford',
  'brentford fc': 'Brentford',
  'brighton': 'Brighton',
  'brighton & hove albion': 'Brighton',
  'brighton and hove albion': 'Brighton',
  'brighton & hove albion fc': 'Brighton',
  'chelsea': 'Chelsea',
  'chelsea fc': 'Chelsea',
  'crystal palace': 'Crystal Palace',
  'crystal palace fc': 'Crystal Palace',
  'everton': 'Everton',
  'everton fc': 'Everton',
  'fulham': 'Fulham',
  'fulham fc': 'Fulham',
  'ipswich': 'Ipswich',
  'ipswich town': 'Ipswich',
  'ipswich town fc': 'Ipswich',
  'leeds': 'Leeds United',
  'leeds united': 'Leeds United',
  'leeds united fc': 'Leeds United',
  'leicester': 'Leicester',
  'leicester city': 'Leicester',
  'leicester city fc': 'Leicester',
  'liverpool': 'Liverpool',
  'liverpool fc': 'Liverpool',
  'man city': 'Manchester City',
  'manchester city': 'Manchester City',
  'manchester city fc': 'Manchester City',
  'man united': 'Manchester United',
  'man utd': 'Manchester United',
  'manchester united': 'Manchester United',
  'manchester united fc': 'Manchester United',
  'newcastle': 'Newcastle',
  'newcastle united': 'Newcastle',
  'newcastle united fc': 'Newcastle',
  'nottingham forest': 'Nottingham Forest',
  'nottingham forest fc': 'Nottingham Forest',
  "nott'm forest": 'Nottingham Forest',
  'nottm forest': 'Nottingham Forest',
  'southampton': 'Southampton',
  'southampton fc': 'Southampton',
  'tottenham': 'Tottenham',
  'tottenham hotspur': 'Tottenham',
  'tottenham hotspur fc': 'Tottenham',
  // 'spurs' is ambiguous (Tottenham Hotspur vs San Antonio Spurs) — map to NBA team
  // since Tottenham is already covered by the three entries above
  'spurs': 'San Antonio Spurs',
  'san antonio spurs': 'San Antonio Spurs',
  'west ham': 'West Ham',
  'west ham united': 'West Ham',
  'west ham united fc': 'West Ham',
  'wolves': 'Wolverhampton',
  'wolverhampton': 'Wolverhampton',
  'wolverhampton wanderers': 'Wolverhampton',
  'wolverhampton wanderers fc': 'Wolverhampton',

  // UCL clubs
  'ac milan': 'AC Milan',
  'ac milan fc': 'AC Milan',
  'ajax': 'Ajax',
  'afc ajax': 'Ajax',
  'ajax amsterdam': 'Ajax',
  'atletico madrid': 'Atletico Madrid',
  'atletico de madrid': 'Atletico Madrid',
  'club atletico de madrid': 'Atletico Madrid',
  'club atlético de madrid': 'Atletico Madrid',
  'atletico': 'Atletico Madrid',
  'atletico madrid fc': 'Atletico Madrid',
  'barcelona': 'Barcelona',
  'fc barcelona': 'Barcelona',
  'fc barcelona b': 'Barcelona',
  'bayer leverkusen': 'Bayer Leverkusen',
  'bayer 04 leverkusen': 'Bayer Leverkusen',
  'benfica': 'Benfica',
  'sl benfica': 'Benfica',
  'borussia dortmund': 'Borussia Dortmund',
  'bvb': 'Borussia Dortmund',
  'dortmund': 'Borussia Dortmund',
  'celtic': 'Celtic',
  'celtic fc': 'Celtic',
  // 'chelsea' and 'chelsea fc' already in EPL section above
  'club brugge': 'Club Brugge',
  'club brugge kv': 'Club Brugge',
  'feyenoord': 'Feyenoord',
  'galatasaray': 'Galatasaray',
  'galatasaray sk': 'Galatasaray',
  'inter': 'Inter Milan',
  'inter milan': 'Inter Milan',
  'fc internazionale': 'Inter Milan',
  'fc internazionale milano': 'Inter Milan',
  'internazionale': 'Inter Milan',
  'juventus': 'Juventus',
  'juventus fc': 'Juventus',
  'lille': 'Lille',
  'losc lille': 'Lille',
  // 'manchester city', 'manchester city fc', 'man city' already in EPL section above
  'monaco': 'Monaco',
  'as monaco': 'Monaco',
  // 'newcastle', 'newcastle united', 'newcastle united fc' already in EPL section above
  'paris saint-germain': 'PSG',
  'paris saint germain': 'PSG',
  'paris saint-germain fc': 'PSG',
  'paris saint germain fc': 'PSG',
  'paris saint': 'PSG', // Polymarket sometimes truncates to "Paris Saint"
  'psg': 'PSG',
  'porto': 'Porto',
  'fc porto': 'Porto',
  'psv': 'PSV',
  'psv eindhoven': 'PSV',
  'rangers': 'Rangers',
  'rangers fc': 'Rangers',
  'rb leipzig': 'RB Leipzig',
  'rasenballsport leipzig': 'RB Leipzig',
  'real madrid': 'Real Madrid',
  'real madrid cf': 'Real Madrid',
  'red star belgrade': 'Red Star Belgrade',
  'crvena zvezda': 'Red Star Belgrade',
  'sporting cp': 'Sporting CP',
  'sporting clube de portugal': 'Sporting CP',
  'sporting clube de portugal cp': 'Sporting CP',
  'slovan bratislava': 'Slovan Bratislava',
  'sk slovan bratislava': 'Slovan Bratislava',
  'stade brestois': 'Stade Brestois',
  'stade brestois 29': 'Stade Brestois',
  'bayern munich': 'Bayern Munich',
  'fc bayern münchen': 'Bayern Munich',
  'fc bayern munchen': 'Bayern Munich',
  'fc bayern munich': 'Bayern Munich',
  'bayern münchen': 'Bayern Munich',
  'bay münchen': 'Bayern Munich',

  // Copa Libertadores — both platforms use the city-suffixed form; keep it
  'libertad asuncion': 'Libertad Asuncion',
  'club libertad': 'Libertad Asuncion',
  'olimpia asuncion': 'Olimpia Asuncion',
  'club olimpia': 'Olimpia Asuncion',

  // Copa Libertadores — SX Bet appends state/region suffix ("SP" = São Paulo state)
  'corinthians sp': 'Corinthians',
  'sc corinthians paulista': 'Corinthians',
  'corinthians paulista': 'Corinthians',    // stripped form of "SC Corinthians Paulista"
  'palmeiras sp': 'Palmeiras',

  // Copa Libertadores — suffixes not in auto-strip (EC, FR, FBPA, SP city codes)
  'cruzeiro esporte clube': 'Cruzeiro',
  'cruzeiro ec': 'Cruzeiro',
  'botafogo fr': 'Botafogo RJ',             // SX Bet: "Botafogo RJ" (not FR)
  'grêmio fbpa': 'Gremio',                  // SX Bet: "Gremio" (no accent)
  'gremio fbpa': 'Gremio',
  'fortaleza ec': 'Fortaleza',

  // Copa Libertadores — Brazilian state suffixes (SX Bet appends state code)
  'santos fc': 'Santos FC SP',
  'sao paulo fc': 'São Paulo FC',           // normalise accent: SX Bet "Sao Paulo FC"
  'são paulo fc': 'São Paulo FC',
  'sao paulo': 'São Paulo FC',
  'são paulo': 'São Paulo FC',

  // Copa Libertadores — SX Bet uses full club legal name for River Plate
  'club atletico river plate argentina': 'River Plate',
  'atletico river plate argentina': 'River Plate',

  // Copa Libertadores — CA Mineiro = Atletico Mineiro (SX Bet has no accent)
  'ca mineiro': 'Atletico Mineiro',
  'atletico mineiro': 'Atletico Mineiro',
  'atlético mineiro': 'Atletico Mineiro',

  // Copa Libertadores — SX Bet uses full name, Polymarket uses abbreviation or vice versa
  'liga deportiva universitaria de quito': 'LDU de Quito',
  'universidad central de venezuela fc': 'UCV',
  'universidad central de venezuela': 'UCV',
  'cs cristal': 'Sporting Cristal',         // Polymarket "CS Cristal" → SX Bet "Sporting Cristal"
  'cd tolima': 'Deportes Tolima',           // Polymarket "CD Tolima" → SX Bet "Deportes Tolima"
  'tolima': 'Deportes Tolima',

  // Copa Libertadores — city suffix or accent differences after stripping
  'penarol de montevideo': 'Peñarol',
  'penarol': 'Peñarol',
  'barcelona sporting club': 'Barcelona',  // Copa Lib Ecuador club
  'barcelona sc': 'Barcelona',             // Polymarket form — override any generated cross-league match
  // Liverpool FC (Uruguay) — prevent false match with English Liverpool
  'liverpool fc uruguay': 'Liverpool Uruguay',
  'universidad catolica santiago': 'Universidad Católica',
  'universidad catolica': 'Universidad Católica',
  'club bolivar': 'Bolívar',
  'bolivar': 'Bolívar',

  // Copa Libertadores — case consistency for "Universitario de Deportes"
  // Generated entry has capital-D form; these MANUAL entries override it
  'club universitario de deportes': 'Universitario de Deportes',
  'universitario de deportes': 'Universitario de Deportes',
  'club universitario': 'Universitario de Deportes',

  // Copa Libertadores — CSyD and AA prefixes not in auto-strip list
  'csyd defensa y justicia': 'Defensa y Justicia',
  'csyd macará': 'Macará',
  'csyd macara': 'Macará',
  'aa argentinos juniors': 'Argentinos Juniors',

  // Serie A — Polymarket appends "Calcio" or year suffix to some clubs
  'cagliari calcio': 'Cagliari',
  'como 1907': 'Como',

  // Serie A — SX Bet uses "Hellas Verona", Polymarket uses "Verona"
  'hellas verona': 'Hellas Verona',
  'verona': 'Hellas Verona',

  // Serie A — "Calcio" suffix not in auto-strip list
  'udinese calcio': 'Udinese',
  'udinese': 'Udinese',

  // Serie A — "Calcio" suffix + Polymarket prepends "US"
  'sassuolo calcio': 'Sassuolo',
  'us sassuolo calcio': 'Sassuolo',
  'sassuolo': 'Sassuolo',

  // Serie A — SX Bet uses full legal name, Polymarket uses abbreviation
  'unione sportiva cremonese': 'Cremonese',
  'us cremonese': 'Cremonese',
  'cremonese': 'Cremonese',

  // La Liga — SX Bet uses short form, Polymarket uses full club legal name
  'athletic club': 'Athletic Bilbao',
  'athletic bilbao': 'Athletic Bilbao',
  'rc celta de vigo': 'Celta de Vigo',
  'celta de vigo': 'Celta de Vigo',
  'celta': 'Celta de Vigo',
  'deportivo alavés': 'Deportivo Alaves',
  'deportivo alaves': 'Deportivo Alaves',
  'alavés': 'Deportivo Alaves',
  'alaves': 'Deportivo Alaves',
  'rcd espanyol de barcelona': 'Espanyol',
  'rcd espanyol': 'Espanyol',
  'espanyol': 'Espanyol',
  'levante ud': 'Levante',
  'levante': 'Levante',
  'rcd mallorca': 'Mallorca',
  'mallorca': 'Mallorca',
  'rayo vallecano de madrid': 'Rayo Vallecano',
  'rayo vallecano': 'Rayo Vallecano',
  'real betis balompié': 'Real Betis',
  'real betis balompie': 'Real Betis',
  'real betis': 'Real Betis',
  'real sociedad de fútbol': 'Real Sociedad',
  'real sociedad de futbol': 'Real Sociedad',
  'real sociedad': 'Real Sociedad',

  // Ligue 1 — SX Bet uses short form, Polymarket uses full club legal name
  'aj auxerre': 'Auxerre',
  'auxerre': 'Auxerre',
  'angers sco': 'Angers',
  'angers sc': 'Angers',
  'angers': 'Angers',
  'fc lorient': 'Lorient',
  'lorient': 'Lorient',
  'fc metz': 'Metz',
  'metz': 'Metz',
  'ogc nice': 'Nice',
  'nice': 'Nice',
  'rc strasbourg alsace': 'Strasbourg',
  'rc strasbourg': 'Strasbourg',
  'strasbourg': 'Strasbourg',
  'lille osc': 'Lille',
  'olympique lyonnais': 'Lyon',
  'olympique lyon': 'Lyon',
  'lyon': 'Lyon',
  'olympique de marseille': 'Olympique Marseille',
  'olympique marseille': 'Olympique Marseille',
  'marseille': 'Olympique Marseille',
  'racing club de lens': 'Lens',
  'rc lens': 'Lens',
  'lens': 'Lens',
  'stade rennais fc 1901': 'Rennes',
  'stade rennais': 'Rennes',
  'rennes': 'Rennes',

  // World Cup national teams — SX and Polymarket spell several countries differently.
  // Each variant (SX market spelling + Polymarket spelling) maps to one canonical
  // string so the same fixture links across platforms. Confirmed against live
  // SX league 1715 fixtures + Poly series 11433. Nations whose SX fixtures aren't
  // posted yet (e.g. Czechia→?Czech Republic, DR Congo) are intentionally omitted
  // until their SX spelling can be confirmed from a live fixture.
  'usa': 'USA',
  'united states': 'USA',
  'ivory coast': 'Ivory Coast',
  "côte d'ivoire": 'Ivory Coast',
  "cote d'ivoire": 'Ivory Coast',
  'south korea': 'South Korea',
  'korea republic': 'South Korea',
  'iran': 'Iran',
  'ir iran': 'Iran',
  'turkey': 'Türkiye',
  'turkiye': 'Türkiye',
  'türkiye': 'Türkiye',
  'cape verde': 'Cape Verde',
  'cabo verde': 'Cape Verde',
  'bosnia-herz': 'Bosnia-Herzegovina',
  'bosnia-herzegovina': 'Bosnia-Herzegovina',
  'bosnia': 'Bosnia-Herzegovina',

  // NBA — Polymarket uses nickname-only (e.g. "Raptors"); SX Bet uses "City Nickname" full form.
  // These mappings make both platforms resolve to the same canonical name for DB matching.
  'hawks': 'Atlanta Hawks',
  'celtics': 'Boston Celtics',
  'nets': 'Brooklyn Nets',
  'hornets': 'Charlotte Hornets',
  'bulls': 'Chicago Bulls',
  'cavaliers': 'Cleveland Cavaliers',
  'mavericks': 'Dallas Mavericks',
  'nuggets': 'Denver Nuggets',
  'pistons': 'Detroit Pistons',
  'warriors': 'Golden State Warriors',
  'rockets': 'Houston Rockets',
  'pacers': 'Indiana Pacers',
  'clippers': 'Los Angeles Clippers',
  'lakers': 'L.A. Lakers',
  'los angeles lakers': 'L.A. Lakers',
  'la lakers': 'L.A. Lakers',
  'grizzlies': 'Memphis Grizzlies',
  'heat': 'Miami Heat',
  'bucks': 'Milwaukee Bucks',
  'timberwolves': 'Minnesota Timberwolves',
  'pelicans': 'New Orleans Pelicans',
  'knicks': 'New York Knicks',
  'thunder': 'Oklahoma City Thunder',
  'magic': 'Orlando Magic',
  '76ers': 'Philadelphia 76ers',
  'sixers': 'Philadelphia 76ers',
  'suns': 'Phoenix Suns',
  'trail blazers': 'Portland Trail Blazers',
  'blazers': 'Portland Trail Blazers',
  'kings': 'Sacramento Kings',
  // 'spurs' and 'san antonio spurs' already mapped above
  'raptors': 'Toronto Raptors',
  'jazz': 'Utah Jazz',
  'wizards': 'Washington Wizards',
};

/**
 * Sport-scoped overrides for names that collide across leagues.
 * Example: "Kings" = Sacramento Kings in NBA but Los Angeles Kings in NHL;
 * "Rangers" = Glasgow Rangers in UCL but New York Rangers in NHL.
 * Checked BEFORE the global MANUAL map when a sport hint is passed.
 */
const MANUAL_BY_SPORT: Record<string, Record<string, string>> = {
  Hockey: {
    // Polymarket sends nickname-only (e.g. "Sabres"); SX Bet uses "City Nickname".
    'ducks': 'Anaheim Ducks',
    'anaheim ducks': 'Anaheim Ducks',
    'bruins': 'Boston Bruins',
    'boston bruins': 'Boston Bruins',
    'sabres': 'Buffalo Sabres',
    'buffalo sabres': 'Buffalo Sabres',
    'flames': 'Calgary Flames',
    'calgary flames': 'Calgary Flames',
    'hurricanes': 'Carolina Hurricanes',
    'carolina hurricanes': 'Carolina Hurricanes',
    'blackhawks': 'Chicago Blackhawks',
    'chicago blackhawks': 'Chicago Blackhawks',
    'avalanche': 'Colorado Avalanche',
    'colorado avalanche': 'Colorado Avalanche',
    'blue jackets': 'Columbus Blue Jackets',
    'columbus blue jackets': 'Columbus Blue Jackets',
    'stars': 'Dallas Stars',
    'dallas stars': 'Dallas Stars',
    'red wings': 'Detroit Red Wings',
    'detroit red wings': 'Detroit Red Wings',
    'oilers': 'Edmonton Oilers',
    'edmonton oilers': 'Edmonton Oilers',
    'panthers': 'Florida Panthers',
    'florida panthers': 'Florida Panthers',
    'kings': 'Los Angeles Kings',
    'los angeles kings': 'Los Angeles Kings',
    'la kings': 'Los Angeles Kings',
    'wild': 'Minnesota Wild',
    'minnesota wild': 'Minnesota Wild',
    'canadiens': 'Montreal Canadiens',
    'montreal canadiens': 'Montreal Canadiens',
    'habs': 'Montreal Canadiens',
    'predators': 'Nashville Predators',
    'nashville predators': 'Nashville Predators',
    'preds': 'Nashville Predators',
    'devils': 'New Jersey Devils',
    'new jersey devils': 'New Jersey Devils',
    'islanders': 'New York Islanders',
    'new york islanders': 'New York Islanders',
    'rangers': 'New York Rangers',
    'new york rangers': 'New York Rangers',
    'senators': 'Ottawa Senators',
    'ottawa senators': 'Ottawa Senators',
    'sens': 'Ottawa Senators',
    'flyers': 'Philadelphia Flyers',
    'philadelphia flyers': 'Philadelphia Flyers',
    'penguins': 'Pittsburgh Penguins',
    'pittsburgh penguins': 'Pittsburgh Penguins',
    'pens': 'Pittsburgh Penguins',
    'sharks': 'San Jose Sharks',
    'san jose sharks': 'San Jose Sharks',
    'kraken': 'Seattle Kraken',
    'seattle kraken': 'Seattle Kraken',
    'blues': 'St. Louis Blues',
    'st. louis blues': 'St. Louis Blues',
    'st louis blues': 'St. Louis Blues',
    'lightning': 'Tampa Bay Lightning',
    'tampa bay lightning': 'Tampa Bay Lightning',
    'bolts': 'Tampa Bay Lightning',
    'maple leafs': 'Toronto Maple Leafs',
    'toronto maple leafs': 'Toronto Maple Leafs',
    'leafs': 'Toronto Maple Leafs',
    // Utah is mid-rebrand: Polymarket has both "Utah" and "Mammoth"; SX is still "Utah Hockey Club"
    'utah': 'Utah Hockey Club',
    'mammoth': 'Utah Hockey Club',
    'utah mammoth': 'Utah Hockey Club',
    'utah hockey club': 'Utah Hockey Club',
    'canucks': 'Vancouver Canucks',
    'vancouver canucks': 'Vancouver Canucks',
    'golden knights': 'Vegas Golden Knights',
    'vegas golden knights': 'Vegas Golden Knights',
    'vgk': 'Vegas Golden Knights',
    'capitals': 'Washington Capitals',
    'washington capitals': 'Washington Capitals',
    'caps': 'Washington Capitals',
    'jets': 'Winnipeg Jets',
    'winnipeg jets': 'Winnipeg Jets',
  },
};

/**
 * Merged map: GENERATED_CANONICAL (auto-generated by sync-teams script) is the base,
 * MANUAL entries override it so hand-written aliases always win.
 */
const CANONICAL: Record<string, string> = { ...GENERATED_CANONICAL, ...MANUAL };

/**
 * Common organizational prefixes and suffixes that differ between platforms.
 * Stripping these lets "CA Lanús" and "Lanús" map to the same canonical name
 * without requiring an explicit entry for every club in every league.
 *
 * The CANONICAL map is checked first — entries like "club brugge" are
 * intentionally preserved there and won't hit this path.
 */
const STRIP_PREFIX = /^(ca|cd|cf|csd|se|sc|sd|ec|cr|cs|gd|fk|nk|bk|as|ac|sl|sk|rb|afc|ssc|bsc|hsv|club)\s+/i;
const STRIP_SUFFIX = /\s+(fc|cf|sc|sd|afc|ssc|kv|ac|bk|if)$/i;

// Strip trailing parenthetical city/disambiguation suffixes before prefix/suffix strip.
// e.g. "Stade Brestois (Brest)" → "Stade Brestois", "CA Lanús (Argentina)" → "CA Lanús"
const STRIP_PARENS = /\s*\([^)]*\)\s*$/;

export function stripAffixes(raw: string): string {
  return raw.trim().replace(STRIP_PARENS, '').replace(STRIP_PREFIX, '').replace(STRIP_SUFFIX, '').trim();
}

/**
 * Returns the canonical team name for `raw`.
 *
 * Pass `sport` (e.g. 'Hockey', 'Basketball') when names may collide across leagues:
 * "Kings" resolves to Sacramento Kings (NBA) without a hint but Los Angeles Kings (NHL)
 * with sport='Hockey'. Sport-scoped lookup runs first; falls through to global maps.
 *
 * Resolution order:
 *   1. Sport-scoped override (MANUAL_BY_SPORT[sport]) — exact, then affix-stripped
 *   2. Exact match in CANONICAL (explicit aliases + auto-generated entries)
 *   3. Affix-stripped match in CANONICAL
 *   4. Affix-stripped raw name (e.g. "CA Lanús" → "Lanús", "Club Always Ready" → "Always Ready")
 *   5. Raw trimmed string as fallback
 */
export function canonicalTeamName(raw: string, sport?: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  const sportMap = sport ? MANUAL_BY_SPORT[sport] : undefined;

  // 1. Sport-scoped exact match
  if (sportMap && sportMap[lower]) return sportMap[lower];

  // 2. Exact match in global CANONICAL
  if (CANONICAL[lower]) return CANONICAL[lower];

  // 3. Strip affixes and check sport-scoped map, then global CANONICAL
  const stripped = stripAffixes(trimmed);
  const strippedLower = stripped.toLowerCase();
  if (strippedLower !== lower) {
    if (sportMap && sportMap[strippedLower]) return sportMap[strippedLower];
    if (CANONICAL[strippedLower]) return CANONICAL[strippedLower];
  }

  // 4. Use stripped raw name
  if (stripped && stripped !== trimmed) return stripped;

  // 5. Unknown — return as-is
  return trimmed;
}
