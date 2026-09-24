// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { KeyboardAdapter } from './keyboard-adapter.js';

describe('keyboard controls and native focus', () => {
  it.each(['button', 'input', 'textarea'])('leaves Enter and Space to a focused %s', (tag) => {
    document.body.innerHTML = `<${tag}></${tag}>`;
    const control = document.body.firstElementChild;
    const onAction = vi.fn();
    const adapter = new KeyboardAdapter(onAction, { target: window });
    adapter.attach();
    try {
      for (const code of ['Enter', 'Space']) {
        const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true });
        control.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      }
      expect(onAction).not.toHaveBeenCalled();
    } finally { adapter.detach(); }
  });

  it('releases movement when focus changes while a key is held', () => {
    document.body.innerHTML = '<input>';
    const onAction = vi.fn();
    const adapter = new KeyboardAdapter(onAction, { target: window });
    adapter.attach();
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
      document.querySelector('input').dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', bubbles: true }));
      expect(onAction.mock.calls.map((call) => call[1].pressed)).toEqual([true, false]);
    } finally { adapter.detach(); }
  });
});
