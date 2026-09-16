// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { TouchControls } from './touch-controls.js';
import { Actions } from '../input/actions.js';

describe('TouchControls', () => {
  it('exposes left/right/jump buttons mapped to their semantic actions', () => {
    const controls = new TouchControls({ root: document.createElement('div') });
    const actions = controls.buttons.map((b) => b.action).sort();
    expect(actions).toEqual([Actions.JUMP, Actions.MOVE_LEFT, Actions.MOVE_RIGHT].sort());
    for (const { element } of controls.buttons) {
      expect(element).toBeInstanceOf(HTMLButtonElement);
      expect(element.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('mounts buttons into the root on show() and clears them on hide()', () => {
    const root = document.createElement('div');
    const controls = new TouchControls({ root });

    controls.show();
    expect(root.querySelectorAll('button')).toHaveLength(3);

    controls.hide();
    expect(root.querySelectorAll('button')).toHaveLength(0);
  });

  it('keeps the same button elements across show/hide so a TouchAdapter stays wired', () => {
    const root = document.createElement('div');
    const controls = new TouchControls({ root });
    const before = controls.buttons.map((b) => b.element);

    controls.show();
    controls.hide();
    controls.show();

    const after = controls.buttons.map((b) => b.element);
    expect(after).toEqual(before);
  });
});
