import { describe, expect, it, vi } from 'vitest';
import { MemoryStorageAdapter } from './storage-adapter.js';
import { CONTROLS_PRACTICE_KEY, TOUCH_LAYOUT_KEY } from './storage-keys.js';
import { DEFAULT_TOUCH_LAYOUT, TouchLayoutStore, isDefaultTouchLayout, normalizeTouchLayout } from './touch-layout-store.js';
import { ControlsPracticeStore } from './controls-practice-store.js';

describe('TouchLayoutStore (docs/18 §7)', () => {
  it('defaults when nothing or garbage is stored', () => {
    expect(new TouchLayoutStore(new MemoryStorageAdapter()).read()).toEqual(DEFAULT_TOUCH_LAYOUT);
    const broken = new MemoryStorageAdapter({ [TOUCH_LAYOUT_KEY]: '{not json' });
    expect(new TouchLayoutStore(broken).read()).toEqual(DEFAULT_TOUCH_LAYOUT);
  });

  it('keeps valid fields and replaces invalid or unknown ones', () => {
    expect(normalizeTouchLayout({ size: 'large', jumpSide: 'up', edgeInset: 999, extra: true })).toEqual({
      size: 'large', jumpSide: 'right', edgeInset: 'near', visibility: 'auto',
    });
    expect(normalizeTouchLayout(null)).toEqual(DEFAULT_TOUCH_LAYOUT);
  });

  it('persists presets, notifies listeners and restores the default instantly', () => {
    const adapter = new MemoryStorageAdapter();
    const store = new TouchLayoutStore(adapter);
    const listener = vi.fn();
    store.subscribe(listener);

    store.update({ size: 'large', jumpSide: 'left' });
    expect(new TouchLayoutStore(adapter).read()).toMatchObject({ size: 'large', jumpSide: 'left', edgeInset: 'near' });
    expect(listener).toHaveBeenLastCalledWith({ size: 'large', jumpSide: 'left', edgeInset: 'near', visibility: 'auto' });
    expect(isDefaultTouchLayout(store.read())).toBe(false);

    store.reset();
    expect(adapter.read(TOUCH_LAYOUT_KEY)).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(DEFAULT_TOUCH_LAYOUT);
    expect(isDefaultTouchLayout(store.read())).toBe(true);
  });

  it('"Sempre mostrar" (hybrids, docs/17 §6) persists and survives "Restaurar controles"', () => {
    const adapter = new MemoryStorageAdapter();
    const store = new TouchLayoutStore(adapter);
    store.update({ visibility: 'always', size: 'large' });
    expect(new TouchLayoutStore(adapter).read().visibility).toBe('always');
    expect(normalizeTouchLayout({ visibility: 'never' }).visibility).toBe('auto');
    store.reset();
    expect(store.read()).toEqual({ ...DEFAULT_TOUCH_LAYOUT, visibility: 'always' });
    expect(isDefaultTouchLayout(store.read())).toBe(true);
    store.update({ visibility: 'auto' });
    store.reset();
    expect(adapter.read(TOUCH_LAYOUT_KEY)).toBeNull();
  });
});

describe('ControlsPracticeStore (docs/18 §8)', () => {
  it('records offer and completion apart from learning progress', () => {
    const adapter = new MemoryStorageAdapter();
    const store = new ControlsPracticeStore(adapter);
    expect(store.read()).toEqual({ offered: false, completed: false });
    store.markOffered();
    expect(store.read()).toEqual({ offered: true, completed: false });
    store.markCompleted();
    expect(new ControlsPracticeStore(adapter).read()).toEqual({ offered: true, completed: true });
  });

  it('survives a corrupted value', () => {
    const adapter = new MemoryStorageAdapter({ [CONTROLS_PRACTICE_KEY]: '{oops' });
    expect(new ControlsPracticeStore(adapter).read()).toEqual({ offered: false, completed: false });
  });
});
