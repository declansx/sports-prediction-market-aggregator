/**
 * Canonical bet keying — maps an Outcome (label + bet type) to a platform-agnostic
 * key keyed off Event. Multiple SX outcomes from opposite-direction markets and
 * multiple Polymarket tokens from per-team binary markets resolve to the same key
 * when they represent the same underlying wager.
 *
 * Lines are normalized to the home team's perspective so e.g. the SX market
 * "Libertad -1.5" and the SX market "Indep +1.5" both produce `spread:home:-1.5`.
 */

export type CanonicalSide =
  | 'home'
  | 'away'
  | 'draw'
  | 'over'
  | 'under'
  | 'not_home'
  | 'not_draw'
  | 'not_away';

export interface CanonicalSpreadComplement {
  side: 'home' | 'away';
  line: number;
}

/**
 * Given one side of a spread, returns the canonical key of its complement
 * (the OTHER outcome of the same conceptual market — the one that wins iff
 * this one loses). E.g. spread:home:-1.5 ↔ spread:away:+1.5.
 */
export function spreadComplementKey(side: 'home' | 'away', signedLine: number): string {
  const otherSide = side === 'home' ? 'away' : 'home';
  const complement = -signedLine;
  const v = complement === 0 ? 0 : complement;
  const norm = v > 0 ? `+${v}` : `${v}`;
  return `spread:${otherSide}:${norm}`;
}

export function parseSpreadKey(key: string): CanonicalSpreadComplement | null {
  const m = key.match(/^spread:(home|away):([+-]?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return { side: m[1] as 'home' | 'away', line: parseFloat(m[2]) };
}

export interface CanonicalBetParts {
  key: string;
  betType: '1x2' | '12' | 'spread' | 'total';
  side: CanonicalSide;
  line: number | null;
}

export interface CanonicalizeResult {
  parts: CanonicalBetParts | null;
  reason?: string;
}

export function canonicalize(
  label: string,
  betType: string,
  homeTeam: string,
  awayTeam: string,
): CanonicalizeResult {
  const lbl = label.trim();

  if (betType === '1x2') {
    if (lbl === homeTeam) return { parts: { key: '1x2:home', betType, side: 'home', line: null } };
    if (lbl === 'Draw') return { parts: { key: '1x2:draw', betType, side: 'draw', line: null } };
    if (lbl === awayTeam) return { parts: { key: '1x2:away', betType, side: 'away', line: null } };
    if (lbl === `Not ${homeTeam}`) return { parts: { key: '1x2:not_home', betType, side: 'not_home', line: null } };
    if (lbl === 'Not Draw') return { parts: { key: '1x2:not_draw', betType, side: 'not_draw', line: null } };
    if (lbl === `Not ${awayTeam}`) return { parts: { key: '1x2:not_away', betType, side: 'not_away', line: null } };
    return { parts: null, reason: '1x2 label did not match home/draw/away/negations' };
  }

  if (betType === '12') {
    if (lbl === homeTeam) return { parts: { key: '12:home', betType, side: 'home', line: null } };
    if (lbl === awayTeam) return { parts: { key: '12:away', betType, side: 'away', line: null } };
    return { parts: null, reason: '12 label did not match home/away' };
  }

  if (betType === 'spread') {
    const m = lbl.match(/^(.+?)\s+([+-]?\d+(?:\.\d+)?)$/);
    if (!m) return { parts: null, reason: 'spread label did not parse' };
    const teamPart = m[1].trim();
    const handicap = parseFloat(m[2]);
    let side: 'home' | 'away';
    if (teamPart === homeTeam) side = 'home';
    else if (teamPart === awayTeam) side = 'away';
    else return { parts: null, reason: `spread team prefix "${teamPart}" not home/away` };
    // Canonical key carries the side AND the signed handicap from THAT side's
    // perspective. "Home -1.5" and "Away +1.5" are complementary outcomes (one
    // wins iff the other loses, odds sum to ~1) — they get DIFFERENT keys so
    // they don't merge into one row. Cross-platform outcomes that represent
    // the same wager (e.g. SX "Home -1.5" + Poly "Home -1.5 YES" + Poly
    // "Away +1.5 NO" labelled "Home -1.5") still share one key and merge.
    const v = handicap === 0 ? 0 : handicap; // normalize -0
    const norm = v > 0 ? `+${v}` : `${v}`;
    return { parts: { key: `spread:${side}:${norm}`, betType, side, line: v } };
  }

  if (betType === 'total') {
    const m = lbl.match(/^(Over|Under)\s+(\d+(?:\.\d+)?)$/i);
    if (!m) return { parts: null, reason: 'total label did not parse' };
    const dir = m[1].toLowerCase() as 'over' | 'under';
    const magnitude = parseFloat(m[2]);
    return { parts: { key: `total:${dir}:${magnitude}`, betType, side: dir, line: magnitude } };
  }

  return { parts: null, reason: `unknown betType ${betType}` };
}
