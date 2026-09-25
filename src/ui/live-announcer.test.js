// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { LiveAnnouncer } from './live-announcer.js';

describe('LiveAnnouncer', () => {
  it('writes to a polite live region and skips repeats', () => {
    const announcer = new LiveAnnouncer(document);
    const region = document.querySelector('[data-testid="live-announcer"]');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('role')).toBe('status');

    announcer.announce('Monte a palavra: GATO');
    expect(region.textContent).toBe('Monte a palavra: GATO');
    region.textContent = 'changed by test';
    announcer.announce('Monte a palavra: GATO');
    expect(region.textContent).toBe('changed by test');

    announcer.reset();
    announcer.announce('Monte a palavra: GATO');
    expect(region.textContent).toBe('Monte a palavra: GATO');
  });

  it('is a no-op without a document', () => {
    const announcer = new LiveAnnouncer(null);
    announcer.announce('oi');
    expect(announcer.text).toBe('oi');
  });
});
