import { VIEWPORT, type Viewport } from '../core/config.js';
import type { HudModel } from './hud-model.js';
import type { CanvasRenderer } from './canvas-renderer.js';

/**
 * Where the HUD may draw, in canvas units, measured from the real page by
 * ui/hud-safe-area.ts. Keeps Canvas indicators inside the device safe areas
 * whatever the screen size.
 */
export interface HudSafeArea {
  /** Device safe-area insets that overlap the canvas. */
  top: number;
  left: number;
  right: number;
  /** Box taken by the DOM buttons in the top-right corner; null when none overlap the canvas. */
  controls: { left: number; bottom: number } | null;
  /** CSS pixels per canvas unit (below 1 when the world is drawn smaller than 960 × 540). */
  displayScale: number;
}

interface HudOptions {
  viewport?: Viewport;
  /** Multiplier for every HUD font (the "Texto ampliado" setting). */
  textScale?: () => number;
  /** Opaque panels and stronger text (the "Alto contraste" setting). */
  highContrast?: () => boolean;
  /** Measured free area; null/absent means no insets and a 1:1 scale. */
  safeArea?: () => HudSafeArea | null;
}

const FONT_FAMILY = '"Trebuchet MS", sans-serif';
const SCREEN_MARGIN = 20;
/** Aims for ~16 CSS px even when the 960-wide world is shown on a 667 px screen. */
const READABLE_FACTOR = 0.9;
const MAX_READABILITY = 1.5;
const MAX_SCALE = 1.8;

/**
 * Canvas part of the heads-up display: only what belongs to the world's space
 * — the assisted-support arrow at the screen edge pointing at the off-screen
 * letter. Level, objective, hearts, progress, letter board and the answer
 * banner are DOM (ui/hud-controls.tsx, docs/17 §4 entrega 5), so they follow
 * text size and zoom and are measured by the layout audit. Only *reads* the
 * HudModel — it never changes game state.
 */
export class Hud {
  renderer: CanvasRenderer;
  viewport: Viewport;
  private _textScale: () => number;
  private _highContrast: () => boolean;
  private _safeArea: () => HudSafeArea | null;

  constructor(
    renderer: CanvasRenderer,
    {
      viewport = VIEWPORT,
      textScale = () => 1,
      highContrast = () => false,
      safeArea = () => null,
    }: HudOptions = {},
  ) {
    this.renderer = renderer;
    this.viewport = viewport;
    this._textScale = textScale;
    this._highContrast = highContrast;
    this._safeArea = safeArea;
  }

  draw(model: HudModel): void {
    this._drawTargetPointer(model);
  }

  private _font(size: number): string {
    return `bold ${Math.round(size)}px ${FONT_FAMILY}`;
  }

  /** Text width, estimated when the renderer cannot measure (tests). */
  private _measure(text: string, size: number): number {
    const measured = this.renderer.measureText?.(text, this._font(size));
    return typeof measured === 'number' && Number.isFinite(measured) ? measured : text.length * size * 0.5;
  }

  /** Assisted support: an edge arrow naming the letter to find while it is off-screen. */
  private _drawTargetPointer(model: HudModel): void {
    const pointer = model.targetPointer;
    if (!pointer) return;
    const safe = this._safeArea();
    const displayScale = safe && safe.displayScale > 0 ? safe.displayScale : 1;
    const readability = Math.min(MAX_READABILITY, Math.max(1, READABLE_FACTOR / displayScale));
    const scale = Math.min(MAX_SCALE, Math.max(1, this._textScale()) * readability);
    const left = SCREEN_MARGIN + (safe?.left ?? 0);
    const right = this.viewport.width - SCREEN_MARGIN - (safe?.right ?? 0);

    const size = 18 * scale;
    const text = pointer.direction === 'right' ? `${pointer.label} ➜` : `⬅ ${pointer.label}`;
    const width = this._measure(text, size) + 24;
    const height = Math.round(34 * scale);
    const y = this.viewport.height / 2 - height / 2;
    const x = pointer.direction === 'right' ? right - width : left;
    const panel = this._highContrast() ? '#000000' : 'rgba(18, 30, 74, 0.85)';
    this.renderer.screenRoundRect(x, y, width, height, 10, panel);
    this.renderer.screenText(text, x + width / 2, y + height / 2, { color: '#ffd166', font: this._font(size) });
  }
}
