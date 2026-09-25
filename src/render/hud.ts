import { COLORS, VIEWPORT, type Viewport } from '../core/config.js';
import { FeedbackKind, type HudModel } from './hud-model.js';
import { formatTime } from '../content/text-utils.js';
import type { CanvasRenderer } from './canvas-renderer.js';

interface HudOptions {
  viewport?: Viewport;
  /** Multiplier for every HUD font (the "Texto ampliado" setting). */
  textScale?: () => number;
  /** Opaque panels and stronger text (the "Alto contraste" setting). */
  highContrast?: () => boolean;
}

const FONT_FAMILY = '"Trebuchet MS", sans-serif';
/** The objective banner stays between the level name and the hearts. */
const OBJECTIVE_MAX_WIDTH = 480;
const SCREEN_MARGIN = 20;

/**
 * Draws the heads-up display: level name, objective banner, hearts and the
 * answer feedback banner. The HUD only *reads* the HudModel — it never changes
 * game state.
 */
export class Hud {
  renderer: CanvasRenderer;
  viewport: Viewport;
  private _textScale: () => number;
  private _highContrast: () => boolean;

  constructor(
    renderer: CanvasRenderer,
    { viewport = VIEWPORT, textScale = () => 1, highContrast = () => false }: HudOptions = {},
  ) {
    this.renderer = renderer;
    this.viewport = viewport;
    this._textScale = textScale;
    this._highContrast = highContrast;
  }

  draw(model: HudModel): void {
    this._drawLevelName(model);
    this._drawObjective(model);
    this._drawHearts(model);
    if (model.isSpeedrun) {
      this._drawSpeedrun(model);
    }
    this._drawWordBoard(model);
    this._drawFeedback(model);
    this._drawTargetPointer(model);
  }

  private get _scale(): number {
    return Math.max(1, this._textScale());
  }

  private _font(size: number): string {
    return `bold ${Math.round(size)}px ${FONT_FAMILY}`;
  }

  private _panel(alpha: number, rgb = '27, 36, 48'): string {
    return this._highContrast() ? '#000000' : `rgba(${rgb}, ${alpha})`;
  }

  /** Text width, estimated when the renderer cannot measure (tests). */
  private _measure(text: string, size: number): number {
    const measured = this.renderer.measureText?.(text, this._font(size));
    return typeof measured === 'number' && Number.isFinite(measured) ? measured : text.length * size * 0.5;
  }

  /** Largest font size (up to `size`) at which `text` fits in `maxWidth`. */
  private _fit(text: string, size: number, maxWidth: number): number {
    const width = this._measure(text, size);
    return width <= maxWidth ? size : Math.max(10, Math.floor((size * maxWidth) / width));
  }

  /** Show-do-Milhão style letter slots: blanks that fill in as letters are found. */
  private _drawWordBoard(model: HudModel): void {
    const slots = model.boardSlots;
    if (slots.length === 0) return;
    const { size, gap, y } = this._boardLayout(slots.length);
    const total = size * slots.length + gap * (slots.length - 1);
    const startX = this.viewport.width / 2 - total / 2;
    const border = this._highContrast() ? 3 : 2;
    const height = size * 1.15;

    slots.forEach((slot, index) => {
      const x = startX + index * (size + gap);
      const dim = this._highContrast() ? '#ffffff' : 'rgba(255, 209, 102, 0.55)';
      const gold = slot.revealed || slot.isNext ? '#ffd166' : dim;
      this.renderer.screenRoundRect(x - border, y - border, size + border * 2, height + border * 2, 9, gold);
      this.renderer.screenRoundRect(x, y, size, height, 8, this._panel(0.82, '18, 30, 74'));
      this.renderer.screenText(slot.revealed ? slot.char : '_', x + size / 2, y + height / 2, {
        color: slot.revealed ? '#ffd166' : this._highContrast() ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
        font: this._font(size * 0.6),
      });
    });
  }

  /** Board sits right under the objective banner, above the player's jump arc. */
  private _boardLayout(count: number): { size: number; gap: number; y: number; bottom: number } {
    const gap = 5;
    const size = Math.min(40 * this._scale, (this.viewport.width - 320 - gap * (count - 1)) / count);
    const y = 12 + this._objectiveHeight + 10;
    return { size, gap, y, bottom: y + size * 1.15 + 2 };
  }

  private get _objectiveHeight(): number {
    return Math.round(42 * this._scale);
  }

  private _drawLevelName(model: HudModel): void {
    this.renderer.screenText(`Fase: ${model.levelName}`, SCREEN_MARGIN, 22, {
      color: COLORS.hudText,
      font: this._font(this._fit(`Fase: ${model.levelName}`, 16 * this._scale, 200)),
      align: 'left',
    });
  }

  private _drawSpeedrun(model: HudModel): void {
    const timeStr = model.showTimer ? `⏱️ ${formatTime(model.timer)}` : '';
    const progressStr = model.speedrunProgress
      ? timeStr
        ? ` · ${model.speedrunProgress}`
        : model.speedrunProgress
      : '';
    const label = `${timeStr}${progressStr}`;
    const width = 168 * this._scale;
    const height = 28 * this._scale;
    const x = SCREEN_MARGIN;
    const y = 44;

    this.renderer.screenRoundRect(x, y, width, height, 8, this._panel(0.85, '18, 24, 38'));
    this.renderer.screenText(label, x + 12, y + height / 2 + 1, {
      color: '#ffd166',
      font: this._font(this._fit(label, 14 * this._scale, width - 20)),
      align: 'left',
    });
  }

  private _drawObjective(model: HudModel): void {
    const text = model.objective || '';
    const size = this._fit(text, 20 * this._scale, OBJECTIVE_MAX_WIDTH - 48);
    const width = Math.min(OBJECTIVE_MAX_WIDTH, Math.max(260, this._measure(text, size) + 48));
    const height = this._objectiveHeight;
    const x = this.viewport.width / 2 - width / 2;
    this.renderer.screenRoundRect(x, 12, width, height, 12, this._panel(0.72));
    this.renderer.screenText(text, this.viewport.width / 2, 12 + height / 2, {
      color: COLORS.hudText,
      font: this._font(size),
    });
  }

  private _drawHearts(model: HudModel): void {
    const size = 22;
    const gap = 8;
    // Leave clearance for both accessible fullscreen and pause controls.
    const rightMargin = 140;
    const startX = this.viewport.width - rightMargin - (size + gap) * model.maxLives;
    model.hearts.forEach((filled, index) => {
      const x = startX + index * (size + gap);
      this.renderer.screenCircle(x + size / 2, 33, size / 2, filled ? COLORS.heartFull : COLORS.heartEmpty);
      this.renderer.screenText('♥', x + size / 2, 33, {
        color: filled ? '#ffffff' : 'rgba(255,255,255,0.35)',
        font: this._font(size - 6),
      });
    });
  }

  private _drawFeedback(model: HudModel): void {
    if (!model.isFeedbackVisible) return;
    const isCorrect = model.feedback.kind === FeedbackKind.CORRECT;
    const contrast = this._highContrast();
    const color = isCorrect
      ? contrast ? '#0b4d12' : 'rgba(46, 125, 50, 0.92)'
      : contrast ? '#6e0f0f' : 'rgba(163, 46, 46, 0.92)';
    const maxWidth = this.viewport.width - SCREEN_MARGIN * 2;
    const message = model.feedback.message;
    // Not colour alone: the banner starts with a sign that says right or wrong.
    const text = `${isCorrect ? '✔' : '✖'} ${message}`;
    const size = this._fit(text, 18 * this._scale, maxWidth - 40);
    const width = Math.min(maxWidth, Math.max(240, this._measure(text, size) + 40));
    const height = Math.round(40 * this._scale);
    const x = this.viewport.width / 2 - width / 2;
    const boardCount = model.wordLetters.length;
    const y = boardCount > 0 ? this._boardLayout(boardCount).bottom + 10 : 12 + this._objectiveHeight + 20;
    this.renderer.screenRoundRect(x, y, width, height, 10, color);
    this.renderer.screenText(text, this.viewport.width / 2, y + height / 2, {
      color: '#ffffff',
      font: this._font(size),
    });
  }

  /** Assisted support: an edge arrow naming the letter to find while it is off-screen. */
  private _drawTargetPointer(model: HudModel): void {
    const pointer = model.targetPointer;
    if (!pointer) return;
    const size = 18 * this._scale;
    const text = pointer.direction === 'right' ? `${pointer.label} ➜` : `⬅ ${pointer.label}`;
    const width = this._measure(text, size) + 24;
    const height = Math.round(34 * this._scale);
    const y = this.viewport.height / 2 - height / 2;
    const x = pointer.direction === 'right' ? this.viewport.width - SCREEN_MARGIN - width : SCREEN_MARGIN;
    this.renderer.screenRoundRect(x, y, width, height, 10, this._panel(0.85, '18, 30, 74'));
    this.renderer.screenText(text, x + width / 2, y + height / 2, { color: '#ffd166', font: this._font(size) });
  }
}
