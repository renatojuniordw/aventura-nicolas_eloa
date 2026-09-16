import { COLORS, VIEWPORT } from '../core/config.js';
import { FeedbackKind } from './hud-model.js';

/**
 * Draws the heads-up display: level name, objective banner, hearts and the
 * answer feedback banner. The HUD only *reads* the HudModel — it never changes
 * game state.
 */
export class Hud {
  constructor(renderer, { viewport = VIEWPORT } = {}) {
    this.renderer = renderer;
    this.viewport = viewport;
  }

  draw(model) {
    this._drawLevelName(model);
    this._drawObjective(model);
    this._drawHearts(model);
    this._drawFeedback(model);
  }

  _drawLevelName(model) {
    this.renderer.screenText(`Fase: ${model.levelName}`, 20, 22, {
      color: COLORS.hudText,
      font: 'bold 16px "Trebuchet MS", sans-serif',
      align: 'left',
    });
  }

  _drawObjective(model) {
    const text = model.objective || '';
    const width = Math.max(260, text.length * 9 + 48);
    const x = this.viewport.width / 2 - width / 2;
    this.renderer.screenRoundRect(x, 12, width, 42, 12, 'rgba(27, 36, 48, 0.72)');
    this.renderer.screenText(text, this.viewport.width / 2, 34, {
      color: COLORS.hudText,
      font: 'bold 20px "Trebuchet MS", sans-serif',
    });
  }

  _drawHearts(model) {
    const size = 22;
    const gap = 8;
    const startX = this.viewport.width - 20 - (size + gap) * model.maxLives;
    model.hearts.forEach((filled, index) => {
      const x = startX + index * (size + gap);
      this.renderer.screenCircle(x + size / 2, 33, size / 2, filled ? COLORS.heartFull : COLORS.heartEmpty);
      this.renderer.screenText('♥', x + size / 2, 33, {
        color: filled ? '#ffffff' : 'rgba(255,255,255,0.35)',
        font: `bold ${size - 6}px "Trebuchet MS", sans-serif`,
      });
    });
  }

  _drawFeedback(model) {
    if (!model.isFeedbackVisible) return;
    const isCorrect = model.feedback.kind === FeedbackKind.CORRECT;
    const color = isCorrect ? 'rgba(46, 125, 50, 0.92)' : 'rgba(163, 46, 46, 0.92)';
    const width = Math.max(240, model.feedback.message.length * 10 + 40);
    const x = this.viewport.width / 2 - width / 2;
    const y = 74;
    this.renderer.screenRoundRect(x, y, width, 40, 10, color);
    this.renderer.screenText(model.feedback.message, this.viewport.width / 2, y + 20, {
      color: '#ffffff',
      font: 'bold 18px "Trebuchet MS", sans-serif',
    });
  }
}
