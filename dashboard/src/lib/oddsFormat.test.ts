import { describe, it, expect } from 'vitest';
import { formatOdds } from './oddsFormat';

describe('formatOdds', () => {
  describe('decimal', () => {
    it('formats even-money', () => expect(formatOdds(0.5, 'decimal')).toBe('2.00'));
    it('formats favourite', () => expect(formatOdds(0.6667, 'decimal')).toBe('1.50'));
    it('formats underdog', () => expect(formatOdds(0.4854, 'decimal')).toBe('2.06'));
    it('returns dash for 0', () => expect(formatOdds(0, 'decimal')).toBe('—'));
    it('returns dash for NaN', () => expect(formatOdds(NaN, 'decimal')).toBe('—'));
    it('returns dash for negative', () => expect(formatOdds(-0.1, 'decimal')).toBe('—'));
    it('returns dash for null', () => expect(formatOdds(null, 'decimal')).toBe('—'));
  });

  describe('american', () => {
    it('formats even-money as +100', () => expect(formatOdds(0.5, 'american')).toBe('+100'));
    it('formats favourite as negative', () => expect(formatOdds(0.6667, 'american')).toBe('-200'));
    it('formats underdog as positive', () => expect(formatOdds(0.4854, 'american')).toBe('+106'));
    it('formats 1.83 decimal as -120', () => expect(formatOdds(1 / 1.83, 'american')).toBe('-120'));
    it('returns dash for 0', () => expect(formatOdds(0, 'american')).toBe('—'));
    it('returns dash for NaN', () => expect(formatOdds(NaN, 'american')).toBe('—'));
    it('returns dash for impliedOdds = 1 (certain outcome)', () => expect(formatOdds(1, 'american')).toBe('—'));
  });

  describe('percent', () => {
    it('formats even-money', () => expect(formatOdds(0.5, 'percent')).toBe('50.0%'));
    it('formats favourite', () => expect(formatOdds(0.6667, 'percent')).toBe('66.7%'));
    it('formats underdog', () => expect(formatOdds(0.4854, 'percent')).toBe('48.5%'));
    it('returns dash for 0', () => expect(formatOdds(0, 'percent')).toBe('—'));
    it('returns dash for NaN', () => expect(formatOdds(NaN, 'percent')).toBe('—'));
  });
});
