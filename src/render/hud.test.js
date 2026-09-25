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

function longModel() {
  const model = new HudModel({ objective: 'Monte a palavra: PAPAI', levelName: 'Quintal das Descobertas', isSpeedrun: true, speedrunProgress: '30/30' });
  model.setWordBoard(['P', 'A', 'P', 'A', 'I'], 2);
  model.showFeedback(FeedbackKind.WRONG, 'Ops! Esse era "X". Procure "P". Tente de novo, você consegue!', 2);
  return model;
}

describe('Hud', () => {
  it('keeps every banner on screen with enlarged text', () => {
    const renderer = recordingRenderer();
    new Hud(renderer, { viewport, textScale: () => 1.25 }).draw(longModel());
    for (const rect of renderer.rects) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(viewport.width);
    }
    // The objective banner never reaches the hearts (which start at 960 - 140 - 90).
    const objective = renderer.rects[0];
    expect(objective.x + objective.w).toBeLessThan(730);
  });

  it('scales fonts with the large-text setting', () => {
    const normal = recordingRenderer();
    const large = recordingRenderer();
    new Hud(normal, { viewport }).draw(longModel());
    new Hud(large, { viewport, textScale: () => 1.25 }).draw(longModel());
    const size = (r) => Number(/(\d+)px/.exec(r.texts.find((t) => t.text === 'Monte a palavra: PAPAI').font)[1]);
    expect(size(large)).toBeGreaterThan(size(normal));
  });

  it('uses opaque panels in high contrast and marks feedback with a sign, not only a colour', () => {
    const renderer = recordingRenderer();
    new Hud(renderer, { viewport, highContrast: () => true }).draw(longModel());
    expect(renderer.rects[0].color).toBe('#000000');
    expect(renderer.texts.some((t) => t.text.startsWith('✖ Ops!'))).toBe(true);
  });

  it('draws the assisted edge pointer only when the model asks for it', () => {
    const renderer = recordingRenderer();
    const model = new HudModel({ objective: 'Colete a letra G' });
    new Hud(renderer, { viewport }).draw(model);
    expect(renderer.texts.some((t) => t.text.includes('➜'))).toBe(false);
    model.setTargetPointer({ direction: 'right', label: 'G' });
    new Hud(renderer, { viewport }).draw(model);
    expect(renderer.texts.some((t) => t.text === 'G ➜')).toBe(true);
  });
});
