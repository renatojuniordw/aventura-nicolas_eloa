import { COLORS, VIEWPORT, type Viewport } from '../core/config.js';
import { FeedbackKind, type HudModel } from './hud-model.js';
import { formatTime } from '../content/text-utils.js';
import type { CanvasRenderer } from './canvas-renderer.js';

/**
 * Where the HUD may draw, in canvas units, measured from the real page by
 * ui/hud-safe-area.ts. Keeps the Canvas HUD out from under the DOM buttons
 * and device safe areas whatever the screen size.
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
  /** Measured free area; null/absent falls back to a fixed clearance for the buttons. */
  safeArea?: () => HudSafeArea | null;
}

interface HudLayout {
  top: number;
  left: number;
  right: number;
  gap: number;
  levelName: { x: number; y: number; maxWidth: number };
  objective: { x: number; width: number; height: number };
  hearts: { x: number; cy: number; size: number; gap: number };
  badge: { x: number; y: number };
  /** Letter board slots (Explorar); null when there is no board. */
  board: { size: number; gap: number; y: number; bottom: number } | null;
  /** Lowest point of the top rows (row 2 included), where the feedback may start. */
  rowsBottom: number;
}

const FONT_FAMILY = '"Trebuchet MS", sans-serif';
const OBJECTIVE_MAX_WIDTH = 480;
const MIN_OBJECTIVE_WIDTH = 260;
const LEVEL_NAME_MAX_WIDTH = 200;
const SCREEN_MARGIN = 20;
/** Clearance for the DOM buttons before their real size is known (tests, first frame). */
const FALLBACK_CONTROLS = { width: 140, bottom: 60 };
/** Minimum spacing between HUD groups, in CSS px. */
const GROUP_GAP_CSS = 8;
/**
 * Readability: the objective aims for ~18 CSS px even when the 960-wide world
 * is shown on a 667 px screen (20 units × 0.9 / displayScale), capped so the
 * HUD never eats the play area.
 */
const READABLE_FACTOR = 0.9;
const MAX_READABILITY = 1.5;
const MAX_SCALE = 1.8;

/**
 * Draws the heads-up display: level name, objective banner, hearts and the
 * answer feedback banner. The HUD only *reads* the HudModel — it never changes
 * game state.
 *
 * Layout is recomputed per frame from the measured safe area: hearts sit left
 * of the DOM buttons; when the objective, level name and hearts don't share a
 * row comfortably, hearts (then the level name) move to a second row instead
 * of shrinking the objective.
 */
export class Hud {
  renderer: CanvasRenderer;
  viewport: Viewport;
  private _textScale: () => number;
  private _highContrast: () => boolean;
  private _safeArea: () => HudSafeArea | null;
  private _scaleNow = 1;

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
    const layout = this._layout(model);
    this._drawLevelName(model, layout);
    this._drawObjective(model, layout);
    this._drawHearts(model, layout);
    if (model.isSpeedrun) {
      this._drawSpeedrun(model, layout);
    }
    this._drawWordBoard(model, layout);
    this._drawFeedback(model, layout);
    this._drawTargetPointer(model, layout);
  }

  private get _scale(): number {
    return this._scaleNow;
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

  private _readSafeArea(): HudSafeArea {
    const measured = this._safeArea();
    if (measured && measured.displayScale > 0) return measured;
    return {
      top: 0,
      left: 0,
      right: 0,
      controls: { left: this.viewport.width - FALLBACK_CONTROLS.width, bottom: FALLBACK_CONTROLS.bottom },
      displayScale: 1,
    };
  }

  private _layout(model: HudModel): HudLayout {
    const safe = this._readSafeArea();
    const readability = Math.min(MAX_READABILITY, Math.max(1, READABLE_FACTOR / safe.displayScale));
    this._scaleNow = Math.min(MAX_SCALE, Math.max(1, this._textScale()) * readability);
    const s = this._scale;

    const gap = Math.max(GROUP_GAP_CSS, GROUP_GAP_CSS / safe.displayScale);
    const top = 12 + safe.top;
    const left = SCREEN_MARGIN + safe.left;
    const right = this.viewport.width - SCREEN_MARGIN - safe.right;
    const center = this.viewport.width / 2;
    const controls = safe.controls;
    const row1Right = controls ? Math.min(right, controls.left - gap) : right;
    const objectiveHeight = this._objectiveHeight;

    const heartSize = Math.round(22 * Math.min(s, 1.4));
    const heartGap = 8;
    const heartsWidth = model.maxLives * heartSize + (model.maxLives - 1) * heartGap;

    const levelText = `Fase: ${model.levelName}`;
    const levelRow1Width = Math.min(LEVEL_NAME_MAX_WIDTH, this._measure(levelText, 16 * s));
    const objectiveText = model.objective || '';
    const desired = Math.min(
      this.viewport.width - left * 2,
      Math.max(MIN_OBJECTIVE_WIDTH, Math.min(OBJECTIVE_MAX_WIDTH * s, this._measure(objectiveText, 20 * s) + 48)),
    );

    // Candidate arrangements, from most compact to most spread out. The
    // speedrun/progress badge hangs under the level name, so it shares its zone.
    const levelZone = left + Math.max(levelRow1Width, model.isSpeedrun ? 168 * s : 0) + gap;
    const candidates = [
      { heartsRow2: false, levelRow2: false, half: Math.min(center - levelZone, row1Right - heartsWidth - gap - center) },
      { heartsRow2: true, levelRow2: false, half: Math.min(center - levelZone, row1Right - center) },
      { heartsRow2: true, levelRow2: true, half: Math.min(center - left - gap, row1Right - center) },
    ];
    const chosen =
      candidates.find((c) => c.half * 2 >= desired) ??
      candidates.reduce((best, c) => (c.half > best.half ? c : best));

    const objectiveWidth = Math.max(0, Math.min(desired, chosen.half * 2));
    const row2Top = Math.max(top + objectiveHeight, controls && chosen.heartsRow2 ? controls.bottom : 0) + gap;

    const hearts = chosen.heartsRow2
      ? { x: right - heartsWidth, cy: row2Top + heartSize / 2, size: heartSize, gap: heartGap }
      : { x: row1Right - heartsWidth, cy: top + objectiveHeight / 2, size: heartSize, gap: heartGap };

    const levelY = chosen.levelRow2 ? row2Top + 8 * s : top + 10;
    const levelName = {
      x: left,
      y: levelY,
      maxWidth: chosen.levelRow2 ? center - left - gap : LEVEL_NAME_MAX_WIDTH,
    };
    const badge = { x: left, y: levelY + 22 * s };
    const badgeBottom = model.isSpeedrun ? badge.y + 28 * s : levelY + 8 * s;

    const leftColumnRight = Math.max(
      chosen.levelRow2 ? left + Math.min(levelName.maxWidth, this._measure(levelText, 16 * s)) : left,
      model.isSpeedrun ? left + 168 * s : left,
    );
    const rowsBottom = Math.max(
      chosen.heartsRow2 ? hearts.cy + heartSize / 2 : 0,
      chosen.levelRow2 || model.isSpeedrun ? badgeBottom : 0,
    );

    // The board sits right under the objective when it fits between the side
    // columns at full size; otherwise it drops below them rather than shrinking.
    let board: HudLayout['board'] = null;
    const count = model.boardSlots.length;
    if (count > 0) {
      const slotGap = 5;
      const full = 40 * s;
      const span = (size: number) => size * count + slotGap * (count - 1);
      const besideHalf = Math.min(
        (this.viewport.width - 320) / 2,
        center - leftColumnRight - gap,
        chosen.heartsRow2 ? hearts.x - gap - center : Infinity,
      );
      const fitsBeside = span(full) / 2 <= besideHalf;
      const half = fitsBeside ? besideHalf : (right - left) / 2;
      const size = Math.max(16, Math.min(full, (half * 2 - slotGap * (count - 1)) / count));
      const y = fitsBeside ? top + objectiveHeight + 10 : Math.max(top + objectiveHeight, rowsBottom) + 10;
      board = { size, gap: slotGap, y, bottom: y + size * 1.15 + 2 };
    }

    return {
      top,
      left,
      right,
      gap,
      levelName,
      objective: { x: center - objectiveWidth / 2, width: objectiveWidth, height: objectiveHeight },
      hearts,
      badge,
      board,
      rowsBottom,
    };
  }

  /** Show-do-Milhão style letter slots: blanks that fill in as letters are found. */
  private _drawWordBoard(model: HudModel, layout: HudLayout): void {
    const slots = model.boardSlots;
    if (slots.length === 0 || !layout.board) return;
    const { size, gap, y } = layout.board;
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

  private get _objectiveHeight(): number {
    return Math.round(42 * this._scale);
  }

  private _drawLevelName(model: HudModel, layout: HudLayout): void {
    const text = `Fase: ${model.levelName}`;
    this.renderer.screenText(text, layout.levelName.x, layout.levelName.y, {
      color: COLORS.hudText,
      font: this._font(this._fit(text, 16 * this._scale, layout.levelName.maxWidth)),
      align: 'left',
    });
  }

  private _drawSpeedrun(model: HudModel, layout: HudLayout): void {
    const timeStr = model.showTimer ? `⏱️ ${formatTime(model.timer)}` : '';
    const progressStr = model.speedrunProgress
      ? timeStr
        ? ` · ${model.speedrunProgress}`
        : model.speedrunProgress
      : '';
    const label = `${timeStr}${progressStr}`;
    const width = 168 * this._scale;
    const height = 28 * this._scale;
    const { x, y } = layout.badge;

    this.renderer.screenRoundRect(x, y, width, height, 8, this._panel(0.85, '18, 24, 38'));
    this.renderer.screenText(label, x + 12, y + height / 2 + 1, {
      color: '#ffd166',
      font: this._font(this._fit(label, 14 * this._scale, width - 20)),
      align: 'left',
    });
  }

  private _drawObjective(model: HudModel, layout: HudLayout): void {
    const text = model.objective || '';
    const { x, width, height } = layout.objective;
    const size = this._fit(text, 20 * this._scale, width - 48);
    this.renderer.screenRoundRect(x, layout.top, width, height, 12, this._panel(0.72));
    this.renderer.screenText(text, this.viewport.width / 2, layout.top + height / 2, {
      color: COLORS.hudText,
      font: this._font(size),
    });
  }

  private _drawHearts(model: HudModel, layout: HudLayout): void {
    const { x: startX, cy, size, gap } = layout.hearts;
    model.hearts.forEach((filled, index) => {
      const x = startX + index * (size + gap);
      this.renderer.screenCircle(x + size / 2, cy, size / 2, filled ? COLORS.heartFull : COLORS.heartEmpty);
      this.renderer.screenText('♥', x + size / 2, cy, {
        color: filled ? '#ffffff' : 'rgba(255,255,255,0.35)',
        font: this._font(size - 6),
      });
    });
  }

  private _drawFeedback(model: HudModel, layout: HudLayout): void {
    if (!model.isFeedbackVisible) return;
    const kind = model.feedback.kind;
    const contrast = this._highContrast();
    const color = kind === FeedbackKind.CORRECT
      ? contrast ? '#0b4d12' : 'rgba(46, 125, 50, 0.92)'
      : kind === FeedbackKind.HINT
        ? contrast ? '#12205a' : 'rgba(33, 66, 140, 0.92)'
        : contrast ? '#6e0f0f' : 'rgba(163, 46, 46, 0.92)';
    const maxWidth = layout.right - layout.left;
    const message = model.feedback.message;
    // Not colour alone: the banner starts with a sign that says right, wrong or hint.
    const sign = kind === FeedbackKind.CORRECT ? '✔' : kind === FeedbackKind.HINT ? '💡' : '✖';
    const text = `${sign} ${message}`;
    const size = this._fit(text, 18 * this._scale, maxWidth - 40);
    const width = Math.min(maxWidth, Math.max(240, this._measure(text, size) + 40));
    const height = Math.round(40 * this._scale);
    const x = this.viewport.width / 2 - width / 2;
    const below = layout.board ? layout.board.bottom + 10 : layout.top + this._objectiveHeight + 20;
    const y = Math.max(below, layout.rowsBottom + 10);
    this.renderer.screenRoundRect(x, y, width, height, 10, color);
    this.renderer.screenText(text, this.viewport.width / 2, y + height / 2, {
      color: '#ffffff',
      font: this._font(size),
    });
  }

  /** Assisted support: an edge arrow naming the letter to find while it is off-screen. */
  private _drawTargetPointer(model: HudModel, layout: HudLayout): void {
    const pointer = model.targetPointer;
    if (!pointer) return;
    const size = 18 * this._scale;
    const text = pointer.direction === 'right' ? `${pointer.label} ➜` : `⬅ ${pointer.label}`;
    const width = this._measure(text, size) + 24;
    const height = Math.round(34 * this._scale);
    const y = this.viewport.height / 2 - height / 2;
    const x = pointer.direction === 'right' ? layout.right - width : layout.left;
    this.renderer.screenRoundRect(x, y, width, height, 10, this._panel(0.85, '18, 30, 74'));
    this.renderer.screenText(text, x + width / 2, y + height / 2, { color: '#ffd166', font: this._font(size) });
  }
}
