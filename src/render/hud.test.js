import { describe, it, expect } from 'vitest';
import { Hud } from './hud.js';
import { HudModel, FeedbackKind } from './hud-model.js';

const viewport = { width: 960, height: 540 };

function recordingRenderer() {
  const rects = [];
  const texts = [];
  return {
    rects,
    texts,
    measureText: (text, font) => String(text).length * Number(/(\d+)px/.exec(font)[1]) * 0.55,
    screenRoundRect: (x, y, w, h, r, color) => rects.push({ x, y, w, h, color }),
    screenText: (text, x, y, options) => texts.push({ text, x, y, ...options }),
    screenCircle: () => {},
  };
}

function fullModel() {
  const model = new HudModel({ objective: 'Monte a palavra: PAPAI', levelName: 'Quintal das Descobertas', isSpeedrun: true, speedrunProgress: '30/30' });
  model.setWordBoard(['P', 'A', 'P', 'A', 'I'], 2);
  model.showFeedback(FeedbackKind.WRONG, 'Ops! Tente de novo.', 2);
  return model;
}

const fontSize = (text) => Number(/(\d+)px/.exec(text.font)[1]);

describe('Hud (Canvas: spatial indicator only, docs/17 §4 entrega 5)', () => {
  it('draws nothing of the informative HUD: level, objective, hearts, board and feedback are DOM', () => {
    const renderer = recordingRenderer();
    new Hud(renderer, { viewport }).draw(fullModel());
    expect(renderer.texts).toEqual([]);
    expect(renderer.rects).toEqual([]);
  });

  it('draws the assisted edge pointer only when the model asks for it', () => {
    const renderer = recordingRenderer();
    const model = new HudModel({ objective: 'Colete a letra G' });
    new Hud(renderer, { viewport }).draw(model);
    expect(renderer.texts.some((t) => t.text.includes('➜'))).toBe(false);
    model.setTargetPointer({ direction: 'right', label: 'G' });
    new Hud(renderer, { viewport }).draw(model);
    expect(renderer.texts.some((t) => t.text === 'G ➜')).toBe(true);
    model.setTargetPointer({ direction: 'left', label: 'G' });
    new Hud(renderer, { viewport }).draw(model);
    expect(renderer.texts.some((t) => t.text === '⬅ G')).toBe(true);
  });

  it('scales the pointer with enlarged text and when the world is shown small', () => {
    const model = new HudModel();
    model.setTargetPointer({ direction: 'right', label: 'G' });
    const base = recordingRenderer();
    const large = recordingRenderer();
    const small = recordingRenderer();
    new Hud(base, { viewport }).draw(model);
    new Hud(large, { viewport, textScale: () => 1.25 }).draw(model);
    new Hud(small, { viewport, safeArea: () => ({ top: 0, left: 0, right: 0, controls: null, displayScale: 667 / 960 }) }).draw(model);
    expect(fontSize(large.texts[0])).toBeGreaterThan(fontSize(base.texts[0]));
    expect(fontSize(small.texts[0]) * (667 / 960)).toBeGreaterThanOrEqual(15.5);
  });

  it('keeps the pointer inside the device safe areas, with an opaque panel in high contrast', () => {
    const area = { top: 20, left: 40, right: 40, controls: null, displayScale: 1 };
    for (const direction of ['left', 'right']) {
      const renderer = recordingRenderer();
      const model = new HudModel();
      model.setTargetPointer({ direction, label: 'P' });
      new Hud(renderer, { viewport, safeArea: () => area, highContrast: () => true }).draw(model);
      const [panel] = renderer.rects;
      expect(panel.x).toBeGreaterThanOrEqual(40);
      expect(panel.x + panel.w).toBeLessThanOrEqual(920);
      expect(panel.color).toBe('#000000');
    }
  });
});
