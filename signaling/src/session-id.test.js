import { describe, it, expect } from 'vitest';
import { generateSessionId, isValidSessionId, SESSION_PATTERN } from './session-id.js';

describe('session-id', () => {
  it('generates codes that match its own validity pattern', () => {
    for (let i = 0; i < 50; i += 1) {
      const id = generateSessionId();
      expect(id).toMatch(SESSION_PATTERN);
      expect(isValidSessionId(id)).toBe(true);
    }
  });

  it('generates 8-character codes without ambiguous characters', () => {
    const id = generateSessionId();
    expect(id).toHaveLength(8);
    expect(id).not.toMatch(/[0O1IL]/);
  });

  it('is not deterministic across calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateSessionId()));
    expect(ids.size).toBeGreaterThan(1);
  });

  it('rejects short or non-alphanumeric codes', () => {
    expect(isValidSessionId('AB12')).toBe(false);
    expect(isValidSessionId('AB12CD!!')).toBe(false);
    expect(isValidSessionId('')).toBe(false);
    expect(isValidSessionId(null)).toBe(false);
    expect(isValidSessionId(undefined)).toBe(false);
  });
});
