import { describe, it, expect } from 'vitest';
import { generateSessionCode, isValidSessionCode, SESSION_PATTERN } from './session-code.js';

describe('session-code', () => {
  it('generates codes that match its own validity pattern', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateSessionCode();
      expect(code).toMatch(SESSION_PATTERN);
      expect(isValidSessionCode(code)).toBe(true);
    }
  });

  it('is not deterministic across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateSessionCode()));
    expect(codes.size).toBeGreaterThan(1);
  });

  it('rejects invalid codes', () => {
    expect(isValidSessionCode('short')).toBe(false);
    expect(isValidSessionCode('AB12CD!!')).toBe(false);
    expect(isValidSessionCode(42)).toBe(false);
    expect(isValidSessionCode(null)).toBe(false);
  });
});
