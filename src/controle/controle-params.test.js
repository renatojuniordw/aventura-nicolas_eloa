import { describe, it, expect } from 'vitest';
import { parseControleParams } from './controle-params.js';

describe('parseControleParams', () => {
  it('reads a valid session code from the query string', () => {
    const { session } = parseControleParams('?session=AB23CD45');
    expect(session).toBe('AB23CD45');
  });

  it('rejects a malformed session instead of trusting the URL blindly', () => {
    expect(parseControleParams('?session=short').session).toBeNull();
    expect(parseControleParams('?session=' + encodeURIComponent('<script>')).session).toBeNull();
  });

  it('defaults session to null when absent', () => {
    expect(parseControleParams('').session).toBeNull();
  });

  it('reads the debug flag only when exactly "1"', () => {
    expect(parseControleParams('?debug=1').debug).toBe(true);
    expect(parseControleParams('?debug=true').debug).toBe(false);
    expect(parseControleParams('').debug).toBe(false);
  });
});
