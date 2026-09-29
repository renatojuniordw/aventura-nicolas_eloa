import { TOUCH_LAYOUT_KEY } from './storage-keys.js';
import type { StorageAdapter } from './storage-adapter.js';

/**
 * Presets for the on-screen controls (docs/18 §7). A few safe choices instead
 * of free dragging: every combination keeps the minimum sizes, stays inside
 * the safe area and cannot make buttons overlap (see touch-controls.css).
 */
export type TouchSize = 'default' | 'large';
export type JumpSide = 'right' | 'left';
export type EdgeInset = 'near' | 'medium' | 'far';
/**
 * When the on-screen buttons appear (docs/17 §6): `auto` follows the primary
 * pointer (`pointer: coarse`); `always` is the manual choice for hybrids
 * (touch laptop, tablet with keyboard) whose primary pointer is fine.
 */
export type TouchVisibility = 'auto' | 'always';

export interface TouchLayout {
  size: TouchSize;
  jumpSide: JumpSide;
  edgeInset: EdgeInset;
  visibility: TouchVisibility;
}

export const DEFAULT_TOUCH_LAYOUT: TouchLayout = Object.freeze({
  size: 'default',
  jumpSide: 'right',
  edgeInset: 'near',
  visibility: 'auto',
});

const SIZES = new Set<TouchSize>(['default', 'large']);
const SIDES = new Set<JumpSide>(['right', 'left']);
const INSETS = new Set<EdgeInset>(['near', 'medium', 'far']);
const VISIBILITIES = new Set<TouchVisibility>(['auto', 'always']);

/** Keeps each valid field and replaces anything unknown with its default. */
export function normalizeTouchLayout(value: unknown): TouchLayout {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof TouchLayout, unknown>>;
  return {
    size: SIZES.has(raw.size as TouchSize) ? (raw.size as TouchSize) : DEFAULT_TOUCH_LAYOUT.size,
    jumpSide: SIDES.has(raw.jumpSide as JumpSide) ? (raw.jumpSide as JumpSide) : DEFAULT_TOUCH_LAYOUT.jumpSide,
    edgeInset: INSETS.has(raw.edgeInset as EdgeInset) ? (raw.edgeInset as EdgeInset) : DEFAULT_TOUCH_LAYOUT.edgeInset,
    visibility: VISIBILITIES.has(raw.visibility as TouchVisibility) ? (raw.visibility as TouchVisibility) : DEFAULT_TOUCH_LAYOUT.visibility,
  };
}

/** Button presets only: whether the buttons are shown at all is a separate choice "Restaurar controles" keeps. */
const PRESET_KEYS = ['size', 'jumpSide', 'edgeInset'] as const;

export function isDefaultTouchLayout(layout: TouchLayout): boolean {
  return PRESET_KEYS.every((key) => layout[key] === DEFAULT_TOUCH_LAYOUT[key]);
}

/** Per-device store, outside SaveStore (not part of any profile). */
export class TouchLayoutStore {
  private _listeners = new Set<(layout: TouchLayout) => void>();

  constructor(private readonly adapter: StorageAdapter) {}

  read(): TouchLayout {
    const raw = this.adapter.read(TOUCH_LAYOUT_KEY);
    if (!raw) return { ...DEFAULT_TOUCH_LAYOUT };
    try {
      return normalizeTouchLayout(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_TOUCH_LAYOUT };
    }
  }

  update(patch: Partial<TouchLayout>): TouchLayout {
    return this._write(normalizeTouchLayout({ ...this.read(), ...patch }));
  }

  /**
   * "Restaurar controles": forgets the presets so future defaults apply too.
   * Keeps "Mostrar botões de toque", or a hybrid would lose the very screen it
   * is on.
   */
  reset(): TouchLayout {
    const { visibility } = this.read();
    if (visibility === DEFAULT_TOUCH_LAYOUT.visibility) {
      this.adapter.remove(TOUCH_LAYOUT_KEY);
      return this._notify({ ...DEFAULT_TOUCH_LAYOUT });
    }
    return this._write({ ...DEFAULT_TOUCH_LAYOUT, visibility });
  }

  subscribe(listener: (layout: TouchLayout) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _write(layout: TouchLayout): TouchLayout {
    this.adapter.write(TOUCH_LAYOUT_KEY, JSON.stringify(layout));
    return this._notify(layout);
  }

  private _notify(layout: TouchLayout): TouchLayout {
    for (const listener of [...this._listeners]) listener({ ...layout });
    return layout;
  }
}
