/**
 * sync-teams: Fetches team names from Polymarket Gamma and SX Bet active markets
 * for every league in SYNCED_LEAGUES, matches them, and writes resolved pairs to
 * src/adapters/teamNamesGenerated.ts.
 *
 * Usage: npm run sync-teams
 *
 * Resolution strategy (per Polymarket team name), applied in order:
 *   1. Exact raw match        → same on both platforms, no entry needed
 *   2. Affix-stripped match   → write active CANONICAL entry
 *   3. Token-subset match     → write active CANONICAL entry (handles year suffixes, "Hellas Verona"/"Verona")
 *   4. Jaro-Winkler ≥ 0.85   → write active CANONICAL entry (high-confidence fuzzy)
 *   5. Jaro-Winkler 0.70–0.84 → write as commented suggestion (low-confidence, needs human review)
 *   6. No match               → write as // [UNRESOLVED] comment line for manual follow-up
 *
 * SX Bet names are treated as canonical (shorter, prefix-free).
 */

import * as fs from 'fs';
import * as path from 'path';
import { SYNCED_LEAGUES } from '../src/sync/marketSync';
import { stripAffixes } from '../src/adapters/teamNames';

const SX_BET_API = 'https://api.sx.bet';
const GAMMA_API = 'https://gamma-api.polymarket.com';
const OUTPUT_PATH = path.join(__dirname, '../src/adapters/teamNamesGenerated.ts');

const JW_HIGH_THRESHOLD = 0.85;
const JW_LOW_THRESHOLD = 0.70;

// ── SX Bet ─────────────────────────────────────────────────────────────────

const SX_BET_DEFAULT_SPORT_ID = 5; // soccer

interface SxTeamRaw {
  id: number;
  name: string;
}

interface SxMarketRaw {
  type: number;
  teamOneName?: string;
  teamTwoName?: string;
}

const _sxTeamsBySport = new Map<number, string[]>();

async function fetchAllSxTeamsBySport(sportId: number): Promise<string[]> {
  if (_sxTeamsBySport.has(sportId)) return _sxTeamsBySport.get(sportId)!;
  const params = new URLSearchParams({ sportId: String(sportId), perPage: '500', page: '0' });
  const res = await fetch(`${SX_BET_API}/teams?${params}`);
  if (!res.ok) throw new Error(`SX Bet /teams returned ${res.status}`);
  const body = (await res.json()) as { data: SxTeamRaw[] };
  const names = body.data.map((t) => t.name?.trim()).filter(Boolean) as string[];
  _sxTeamsBySport.set(sportId, names);
  return names;
}

async function fetchSxActiveMarketTeamNames(leagueId: number): Promise<string[]> {
  const names: string[] = [];
  let paginationKey: string | undefined;
  do {
    const params = new URLSearchParams({ onlyMainLine: 'true', pageSize: '50', leagueId: String(leagueId) });
    if (paginationKey) params.set('paginationKey', paginationKey);
    const res = await fetch(`${SX_BET_API}/markets/active?${params}`);
    if (!res.ok) break;
    const body = (await res.json()) as { data: { markets: SxMarketRaw[]; nextKey?: string } };
    for (const m of body.data.markets) {
      if (m.type !== 1) continue;
      if (m.teamOneName?.trim()) names.push(m.teamOneName.trim());
      if (m.teamTwoName?.trim()) names.push(m.teamTwoName.trim());
    }
    paginationKey = body.data.nextKey || undefined;
  } while (paginationKey);
  return names;
}

async function fetchSxTeamNames(leagueId: number, sportId: number): Promise<{ merged: string[]; activeNames: string[] }> {
  const [allTeams, activeNames] = await Promise.all([
    fetchAllSxTeamsBySport(sportId),
    fetchSxActiveMarketTeamNames(leagueId),
  ]);

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const name of [...activeNames, ...allTeams]) {
    if (!seen.has(name)) { seen.add(name); merged.push(name); }
  }
  console.log(`  [sx]   ${activeNames.length} active-market names + ${allTeams.length} /teams = ${merged.length} merged`);
  return { merged, activeNames };
}

// ── Polymarket ──────────────────────────────────────────────────────────────

interface GammaTeamRaw {
  name: string;
}

async function fetchPolyTeamNames(leagueSlug: string): Promise<string[]> {
  const res = await fetch(`${GAMMA_API}/teams?league=${encodeURIComponent(leagueSlug)}&limit=500`);
  if (!res.ok) throw new Error(`Gamma /teams returned ${res.status}`);
  const teams = (await res.json()) as GammaTeamRaw[];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const t of teams) {
    const name = t.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) { seen.add(key); names.push(name); }
  }
  console.log(`  [poly] team names fetched: ${names.length} (deduped)`);
  return names;
}

// ── Fuzzy matching ──────────────────────────────────────────────────────────

function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchDist = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);
  let matches = 0;

  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - matchDist);
    const hi = Math.min(i + matchDist + 1, b.length);
    for (let j = lo; j < hi; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }

  const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Strips affixes and removes pure-number tokens (year suffixes like "1907"). */
function normaliseTokens(name: string): string[] {
  return stripAffixes(name)
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0 && !/^\d+$/.test(t));
}

function tokenSubsetScore(poly: string, sx: string): number {
  const polyToks = new Set(normaliseTokens(poly));
  const sxToks = new Set(normaliseTokens(sx));
  if (polyToks.size === 0 || sxToks.size === 0) return 0;
  const smaller = polyToks.size <= sxToks.size ? polyToks : sxToks;
  const larger = polyToks.size <= sxToks.size ? sxToks : polyToks;
  const isSubset = [...smaller].every((t) => larger.has(t));
  if (!isSubset) return 0;
  return smaller.size / larger.size; // 1.0 = identical token sets
}

// ── Core matching ───────────────────────────────────────────────────────────

type Confidence = 'high' | 'low';

interface ResolvedPair {
  polyRaw: string;
  sxRaw: string;
  canonical: string;
  confidence: Confidence;
  method: string;
}

/**
 * sxNames      = full pool (active markets + /teams) — used for exact and affix/token matching
 * sxActiveNames = active-market names only — used for Jaro-Winkler to avoid false positives
 *                 from matching against hundreds of unrelated teams in the global /teams pool
 */
function matchTeams(
  polyNames: string[],
  sxNames: string[],
  sxActiveNames: string[],
): { resolved: ResolvedPair[]; unresolved: string[] } {
  const resolved: ResolvedPair[] = [];
  const unresolved: string[] = [];

  const sxByStripped = new Map<string, string>();
  for (const sx of sxNames) {
    sxByStripped.set(stripAffixes(sx).toLowerCase(), sx);
  }
  // Exact-match skip uses active-league names ONLY — matching against the 420-team
  // global /teams pool silently suppresses real mappings when an unrelated league
  // happens to share a name (e.g. "Athletic Club" exists globally but La Liga's
  // SX name is "Athletic Bilbao" — we need to write that mapping).
  const sxActiveLowerSet = new Set(sxActiveNames.map((s) => s.toLowerCase()));

  // Fuzzy pool: active-market names only (league-specific, avoids global-pool false positives)
  const fuzzyPool = sxActiveNames.length > 0 ? sxActiveNames : sxNames;
  const fuzzyPoolLower = fuzzyPool.map((s) => s.toLowerCase());

  for (const poly of polyNames) {
    const polyLower = poly.toLowerCase();

    // 1. Exact raw match against active-league SX names — same name on both platforms
    if (sxActiveLowerSet.has(polyLower)) continue;

    // 2. Affix-stripped match
    const polyStripped = stripAffixes(poly).toLowerCase();
    const sxAffix = sxByStripped.get(polyStripped);
    if (sxAffix) {
      resolved.push({ polyRaw: poly, sxRaw: sxAffix, canonical: sxAffix, confidence: 'high', method: 'affix' });
      continue;
    }

    // 3. Token-subset match (handles "Hellas Verona"/"Verona", "Como 1907"/"Como")
    let bestSubsetSx = '';
    let bestSubsetScore = 0;
    for (const sx of sxNames) {
      const score = tokenSubsetScore(poly, sx);
      if (score > bestSubsetScore) { bestSubsetScore = score; bestSubsetSx = sx; }
    }
    if (bestSubsetScore > 0) {
      resolved.push({ polyRaw: poly, sxRaw: bestSubsetSx, canonical: bestSubsetSx, confidence: 'high', method: 'token-subset' });
      continue;
    }

    // 4 & 5. Jaro-Winkler against active-market pool only
    let bestJwSx = '';
    let bestJwScore = 0;
    for (let i = 0; i < fuzzyPool.length; i++) {
      const score = jaroWinkler(polyLower, fuzzyPoolLower[i]);
      if (score > bestJwScore) { bestJwScore = score; bestJwSx = fuzzyPool[i]; }
    }
    if (bestJwScore >= JW_HIGH_THRESHOLD) {
      resolved.push({ polyRaw: poly, sxRaw: bestJwSx, canonical: bestJwSx, confidence: 'high', method: `jaro-winkler(${bestJwScore.toFixed(2)})` });
      continue;
    }
    if (bestJwScore >= JW_LOW_THRESHOLD) {
      resolved.push({ polyRaw: poly, sxRaw: bestJwSx, canonical: bestJwSx, confidence: 'low', method: `jaro-winkler(${bestJwScore.toFixed(2)})` });
      continue;
    }

    unresolved.push(poly);
  }

  return { resolved, unresolved };
}

// ── File generation ─────────────────────────────────────────────────────────

interface LeagueResult {
  leagueName: string;
  pairs: ResolvedPair[];
  unresolved: string[];
}

function buildFileContent(results: LeagueResult[], runDate: string): string {
  const lines: string[] = [
    '/**',
    ' * AUTO-GENERATED by scripts/syncTeamNames.ts',
    ` * Last run: ${runDate}`,
    ' * Do not edit manually — run `npm run sync-teams` to update.',
    ' *',
    ' * Low-confidence suggestions are commented out — verify and move to',
    ' * teamNames.ts MANUAL map if correct, or delete if wrong.',
    ' */',
    '',
    'export const GENERATED_CANONICAL: Record<string, string> = {',
  ];

  const seen = new Set<string>();

  for (const { leagueName, pairs, unresolved } of results) {
    const highPairs = pairs.filter((p) => {
      if (p.confidence !== 'high') return false;
      const key = p.polyRaw.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const lowPairs = pairs.filter((p) => {
      if (p.confidence !== 'low') return false;
      const key = p.polyRaw.toLowerCase();
      return !seen.has(key);
    });

    if (highPairs.length === 0 && lowPairs.length === 0 && unresolved.length === 0) continue;

    lines.push(`  // --- ${leagueName} ---`);

    for (const { polyRaw, canonical } of highPairs) {
      lines.push(`  ${JSON.stringify(polyRaw.toLowerCase())}: ${JSON.stringify(canonical)},`);
    }

    for (const { polyRaw, canonical, method } of lowPairs) {
      lines.push(`  // [LOW-CONFIDENCE via ${method}] verify before uncommenting:`);
      lines.push(`  // ${JSON.stringify(polyRaw.toLowerCase())}: ${JSON.stringify(canonical)},`);
    }

    for (const name of unresolved) {
      lines.push(`  // [UNRESOLVED] no SX Bet match found — add to teamNames.ts MANUAL map if needed:`);
      lines.push(`  // ${JSON.stringify(name.toLowerCase())}: "",`);
    }
  }

  lines.push('};', '');
  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`sync-teams: running for ${SYNCED_LEAGUES.length} league(s)\n`);

  const results: LeagueResult[] = [];
  let totalHigh = 0;
  let totalLow = 0;
  let totalUnresolved = 0;
  const errors: string[] = [];

  for (const league of SYNCED_LEAGUES) {
    // Gamma /teams?league=X uses the short sport slug (see /sports endpoint), which
    // matches seriesSlugPrefix in LeagueConfig. Falls back to tagSlug for older configs.
    const polyLeagueSlug = league.polymarket?.seriesSlugPrefix ?? league.polymarket?.tagSlug;
    console.log(`[${league.name}] leagueId=${league.sxbet.leagueId} polyLeague=${polyLeagueSlug ?? 'N/A'}`);

    if (!league.polymarket || !polyLeagueSlug) {
      console.log(`  Skipping — no Polymarket config for ${league.name}\n`);
      continue;
    }

    let sxNames: string[] = [];
    let sxActiveNames: string[] = [];
    let polyNames: string[] = [];

    try {
      const sportId = league.sxbet.sportId ?? SX_BET_DEFAULT_SPORT_ID;
      const sx = await fetchSxTeamNames(league.sxbet.leagueId, sportId);
      sxNames = sx.merged;
      sxActiveNames = sx.activeNames;
    } catch (err) {
      const msg = `  [sx]   fetch failed: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      errors.push(`${league.name}: ${msg}`);
    }

    try {
      polyNames = await fetchPolyTeamNames(polyLeagueSlug);
    } catch (err) {
      const msg = `  [poly] fetch failed: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      errors.push(`${league.name}: ${msg}`);
    }

    if (sxNames.length === 0 || polyNames.length === 0) {
      console.log(`  Skipping — one or both sources returned no data\n`);
      continue;
    }

    const { resolved, unresolved } = matchTeams(polyNames, sxNames, sxActiveNames);
    const high = resolved.filter((p) => p.confidence === 'high');
    const low = resolved.filter((p) => p.confidence === 'low');

    results.push({ leagueName: league.name, pairs: resolved, unresolved });
    totalHigh += high.length;
    totalLow += low.length;
    totalUnresolved += unresolved.length;

    console.log(`  high-confidence: ${high.length}  low-confidence: ${low.length}  unresolved: ${unresolved.length}`);

    if (low.length > 0) {
      console.log('  [LOW-CONFIDENCE] — review in generated file:');
      for (const p of low) console.log(`    "${p.polyRaw}" → "${p.sxRaw}" (${p.method})`);
    }
    if (unresolved.length > 0) {
      console.log('  [UNRESOLVED] — add to teamNames.ts MANUAL map if needed:');
      for (const name of unresolved) console.log(`    ${name}`);
    }
    console.log();
  }

  const runDate = new Date().toISOString();
  const content = buildFileContent(results, runDate);
  fs.writeFileSync(OUTPUT_PATH, content, 'utf8');

  console.log('─'.repeat(60));
  console.log(`Written: ${OUTPUT_PATH}`);
  console.log(`Total high-confidence: ${totalHigh}  low-confidence: ${totalLow}  unresolved: ${totalUnresolved}`);

  if (errors.length > 0) {
    console.log('\nErrors encountered:');
    for (const e of errors) console.log(`  ${e}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('sync-teams failed:', err);
  process.exit(1);
});
