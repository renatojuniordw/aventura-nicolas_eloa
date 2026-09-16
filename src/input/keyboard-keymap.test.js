import { describe, it, expect } from 'vitest';
import { translateKey, DEFAULT_KEYMAP, keyLabelFor } from './keyboard-keymap.js';
import { Actions } from './actions.js';

describe('translateKey', () => {
  it('maps arrow keys to movement', () => {
    expect(translateKey('ArrowLeft')).toBe(Actions.MOVE_LEFT);
    expect(translateKey('ArrowRight')).toBe(Actions.MOVE_RIGHT);
  });

  it('maps WASD and A/D equivalents', () => {
    expect(translateKey('KeyA')).toBe(Actions.MOVE_LEFT);
    expect(translateKey('KeyD')).toBe(Actions.MOVE_RIGHT);
  });

  it('maps jump keys', () => {
    expect(translateKey('Space')).toBe(Actions.JUMP);
    expect(translateKey('ArrowUp')).toBe(Actions.JUMP);
    expect(translateKey('KeyW')).toBe(Actions.JUMP);
  });

  it('maps pause, confirm and back', () => {
    expect(translateKey('Escape')).toBe(Actions.PAUSE);
    expect(translateKey('Enter')).toBe(Actions.CONFIRM);
    expect(translateKey('Backspace')).toBe(Actions.BACK);
  });

  it('returns null for unmapped keys', () => {
    expect(translateKey('KeyM')).toBeNull();
    expect(translateKey('F5')).toBeNull();
  });

  it('supports a custom keymap (rebinding)', () => {
    const custom = { KeyM: Actions.JUMP };
    expect(translateKey('KeyM', custom)).toBe(Actions.JUMP);
    // Default bindings are not present in the custom map.
    expect(translateKey('Space', custom)).toBeNull();
  });

  it('exposes reserved power actions without gameplay meaning yet', () => {
    expect(translateKey('KeyE')).toBe(Actions.POWER_1);
    expect(translateKey('KeyQ')).toBe(Actions.POWER_2);
  });
});

describe('keyLabelFor', () => {
  it('renders a human label for movement actions', () => {
    expect(keyLabelFor(Actions.MOVE_LEFT, DEFAULT_KEYMAP)).toContain('←');
  });
});
