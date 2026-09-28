import { describe, expect, it } from 'vitest';
import { ProgressiveHint, hintSteps } from './progressive-hint.js';

describe('progressive hint', () => {
  it('orders repeat, segment and highlight when the word has reviewed syllables', () => {
    expect(hintSteps({ syllables: ['BO', 'LA'], supportLevel: 'standard' })).toEqual(['repeat', 'segment', 'highlight']);
    expect(hintSteps({ syllables: ['BO', 'LA'], supportLevel: 'assisted' })).toEqual(['repeat', 'segment', 'highlight']);
  });

  it('skips the segmentation without a reviewed split, and the marker in challenge', () => {
    expect(hintSteps({ syllables: null, supportLevel: 'standard' })).toEqual(['repeat', 'highlight']);
    expect(hintSteps({ syllables: ['SOL'], supportLevel: 'standard' })).toEqual(['repeat', 'highlight']);
    expect(hintSteps({ syllables: ['BO', 'LA'], supportLevel: 'challenge' })).toEqual(['repeat', 'segment']);
  });

  it('gives one step per request, stays on the last one, and starts over on reset', () => {
    const hint = new ProgressiveHint(['repeat', 'segment', 'highlight']);
    expect([hint.next(), hint.next(), hint.next(), hint.next()]).toEqual(['repeat', 'segment', 'highlight', 'highlight']);
    expect(hint.used).toBe(4);
    hint.reset(['repeat']);
    expect(hint.used).toBe(0);
    expect(hint.next()).toBe('repeat');
  });
});
