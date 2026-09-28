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

  it('marks held buttons without aria-pressed and clears them on hide()', () => {
    const root = document.createElement('div');
    const controls = new TouchControls({ root });
    controls.show();
    const byAction = (action) => controls.buttons.find((b) => b.action === action).element;

    controls.setHeld(Actions.MOVE_RIGHT, true);
    controls.setHeld(Actions.JUMP, true);
    controls.setHeld(Actions.JUMP, false);
    expect(byAction(Actions.MOVE_RIGHT).classList.contains('is-held')).toBe(true);
    expect(byAction(Actions.JUMP).classList.contains('is-held')).toBe(false);
    expect(byAction(Actions.MOVE_RIGHT).hasAttribute('aria-pressed')).toBe(false);

    controls.hide();
    expect(byAction(Actions.MOVE_RIGHT).classList.contains('is-held')).toBe(false);
  });

  it('applies layout presets on the root without replacing buttons, waiting for lifted fingers', () => {
    const root = document.createElement('div');
    const controls = new TouchControls({ root });
    controls.show();
    const before = [...root.querySelectorAll('button')];

    controls.applyLayout({ size: 'large', jumpSide: 'left', edgeInset: 'far' });
    expect(root.dataset).toMatchObject({ touchSize: 'large', jumpSide: 'left', touchInset: 'far' });
    expect([...root.querySelectorAll('button')]).toEqual(before);

    controls.setHeld(Actions.MOVE_LEFT, true);
    controls.applyLayout({ size: 'default', jumpSide: 'right', edgeInset: 'near' });
    expect(root.dataset.jumpSide).toBe('left');
    controls.setHeld(Actions.MOVE_LEFT, false);
    expect(root.dataset).toMatchObject({ touchSize: 'default', jumpSide: 'right', touchInset: 'near' });
  });

  it('hints the buttons a practice step teaches and clears hints on hide()', () => {
    const controls = new TouchControls({ root: document.createElement('div') });
    const jump = controls.buttons.find((b) => b.action === Actions.JUMP).element;
    controls.setHints([Actions.JUMP]);
    expect(jump.classList.contains('is-hinted')).toBe(true);
    controls.hide();
    expect(jump.classList.contains('is-hinted')).toBe(false);
  });
});
