import { describe, it, expect } from 'vitest';
import { canonicalize, spreadComplementKey, parseSpreadKey } from './canonicalize';

const HOME = 'Manchester City';
const AWAY = 'Arsenal';

describe('canonicalize 1x2', () => {
  it('maps home label', () => {
    const r = canonicalize(HOME, '1x2', HOME, AWAY);
    expect(r.parts).toEqual({ key: '1x2:home', betType: '1x2', side: 'home', line: null });
  });

  it('maps draw label', () => {
    const r = canonicalize('Draw', '1x2', HOME, AWAY);
    expect(r.parts?.key).toBe('1x2:draw');
  });

  it('maps away label', () => {
    const r = canonicalize(AWAY, '1x2', HOME, AWAY);
    expect(r.parts?.key).toBe('1x2:away');
  });

  it('maps Not home / Not Draw / Not away', () => {
    expect(canonicalize(`Not ${HOME}`, '1x2', HOME, AWAY).parts?.key).toBe('1x2:not_home');
    expect(canonicalize('Not Draw', '1x2', HOME, AWAY).parts?.key).toBe('1x2:not_draw');
    expect(canonicalize(`Not ${AWAY}`, '1x2', HOME, AWAY).parts?.key).toBe('1x2:not_away');
  });

  it('returns null for unknown label', () => {
    const r = canonicalize('Liverpool', '1x2', HOME, AWAY);
    expect(r.parts).toBeNull();
    expect(r.reason).toMatch(/1x2 label did not match/);
  });
});

describe('canonicalize 12', () => {
  it('maps home / away', () => {
    expect(canonicalize(HOME, '12', HOME, AWAY).parts?.key).toBe('12:home');
    expect(canonicalize(AWAY, '12', HOME, AWAY).parts?.key).toBe('12:away');
  });

  it('returns null for Draw under 12', () => {
    const r = canonicalize('Draw', '12', HOME, AWAY);
    expect(r.parts).toBeNull();
  });
});

describe('canonicalize spread', () => {
  it('home label with negative line', () => {
    const r = canonicalize(`${HOME} -1.5`, 'spread', HOME, AWAY);
    expect(r.parts).toEqual({ key: 'spread:home:-1.5', betType: 'spread', side: 'home', line: -1.5 });
  });

  it('home label with positive line', () => {
    const r = canonicalize(`${HOME} +1.5`, 'spread', HOME, AWAY);
    expect(r.parts).toEqual({ key: 'spread:home:+1.5', betType: 'spread', side: 'home', line: 1.5 });
  });

  it('away label keeps its own perspective (NOT flipped) — complementary to home -1.5', () => {
    // "Away +1.5" is the complement of "Home -1.5" (one wins iff the other loses).
    // They have different canonical keys; their odds sum to ~1.
    const r = canonicalize(`${AWAY} +1.5`, 'spread', HOME, AWAY);
    expect(r.parts).toEqual({ key: 'spread:away:+1.5', betType: 'spread', side: 'away', line: 1.5 });
  });

  it('away label with negative line — complementary to home +1.5', () => {
    const r = canonicalize(`${AWAY} -1.5`, 'spread', HOME, AWAY);
    expect(r.parts?.key).toBe('spread:away:-1.5');
    expect(r.parts?.line).toBe(-1.5);
  });

  it('pick-em line 0 (no sign) parses', () => {
    const r = canonicalize(`${HOME} 0`, 'spread', HOME, AWAY);
    expect(r.parts?.key).toBe('spread:home:0');
    expect(r.parts?.line).toBe(0);
  });

  it('returns null when team prefix matches neither side', () => {
    const r = canonicalize('Liverpool -1.5', 'spread', HOME, AWAY);
    expect(r.parts).toBeNull();
    expect(r.reason).toMatch(/not home\/away/);
  });

  it('returns null when label does not parse', () => {
    const r = canonicalize('garbage', 'spread', HOME, AWAY);
    expect(r.parts).toBeNull();
    expect(r.reason).toMatch(/did not parse/);
  });
});

describe('spreadComplementKey', () => {
  it('home -1.5 ↔ away +1.5', () => {
    expect(spreadComplementKey('home', -1.5)).toBe('spread:away:+1.5');
    expect(spreadComplementKey('away', 1.5)).toBe('spread:home:-1.5');
  });

  it('home +2.5 ↔ away -2.5', () => {
    expect(spreadComplementKey('home', 2.5)).toBe('spread:away:-2.5');
    expect(spreadComplementKey('away', -2.5)).toBe('spread:home:+2.5');
  });

  it('pick-em complement is the other side at 0', () => {
    expect(spreadComplementKey('home', 0)).toBe('spread:away:0');
  });
});

describe('parseSpreadKey', () => {
  it('parses spread:home:-1.5', () => {
    expect(parseSpreadKey('spread:home:-1.5')).toEqual({ side: 'home', line: -1.5 });
  });
  it('parses spread:away:+2.5', () => {
    expect(parseSpreadKey('spread:away:+2.5')).toEqual({ side: 'away', line: 2.5 });
  });
  it('returns null for non-spread keys', () => {
    expect(parseSpreadKey('total:over:2.5')).toBeNull();
    expect(parseSpreadKey('1x2:home')).toBeNull();
  });
});

describe('canonicalize total', () => {
  it('Over with magnitude', () => {
    const r = canonicalize('Over 2.5', 'total', HOME, AWAY);
    expect(r.parts).toEqual({ key: 'total:over:2.5', betType: 'total', side: 'over', line: 2.5 });
  });

  it('Under with magnitude', () => {
    const r = canonicalize('Under 220.5', 'total', HOME, AWAY);
    expect(r.parts?.key).toBe('total:under:220.5');
    expect(r.parts?.line).toBe(220.5);
  });

  it('case insensitive', () => {
    expect(canonicalize('over 2.5', 'total', HOME, AWAY).parts?.key).toBe('total:over:2.5');
    expect(canonicalize('UNDER 9', 'total', HOME, AWAY).parts?.key).toBe('total:under:9');
  });

  it('returns null for bare Over without magnitude', () => {
    const r = canonicalize('Over', 'total', HOME, AWAY);
    expect(r.parts).toBeNull();
  });
});

describe('canonicalize unknown betType', () => {
  it('returns null with reason', () => {
    const r = canonicalize('whatever', 'btts', HOME, AWAY);
    expect(r.parts).toBeNull();
    expect(r.reason).toMatch(/unknown betType/);
  });
});
