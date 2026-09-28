import { describe, it, expect } from 'vitest';
import { Hud } from './hud.js';
import { HudModel, FeedbackKind } from './hud-model.js';

const viewport = { width: 960, height: 540 };

function recordingRenderer() {
  const rects = [];
  const texts = [];
  const circles = [];
  return {
    rects,
    texts,
    measureText: (text, font) => String(text).length * Number(/(\d+)px/.exec(font)[1]) * 0.55,
    screenRoundRect: (x, y, w, h, r, color) => rects.push({ x, y, w, h, color }),
    screenText: (text, x, y, options) => texts.push({ text, x, y, ...options }),
    circles,
    screenCircle: (x, y, r) => circles.push({ x, y, r }),
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

  describe('measured safe area', () => {
    /** The DOM bar as main.ts measures it: `buttons` × 48 px + 8 px gaps, 10 px from the corner. */
    function phoneArea(cssWidth, buttons) {
      const displayScale = cssWidth / 960;
      const barWidth = buttons * 48 + (buttons - 1) * 8;
      return {
        top: 0,
        left: 0,
        right: 0,
        displayScale,
        controls: { left: (cssWidth - 10 - barWidth) / displayScale, bottom: (10 + 48) / displayScale },
      };
    }
    const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

    for (const cssWidth of [568, 667, 960]) {
      for (const buttons of [2, 3]) {
        for (const lives of [0, 1, 3]) {
          for (const textScale of [1, 1.25]) {
            it(`keeps hearts, objective and badge apart (${cssWidth}px, ${buttons} buttons, ${lives} lives, text ×${textScale})`, () => {
              const area = phoneArea(cssWidth, buttons);
              const renderer = recordingRenderer();
              const model = longModel();
              model.lives = lives;
              new Hud(renderer, { viewport, textScale: () => textScale, safeArea: () => area }).draw(model);
              const controls = { x: area.controls.left, y: 0, w: 960 - area.controls.left, h: area.controls.bottom };
              const hearts = renderer.circles.map((c) => ({ x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 }));
              expect(hearts).toHaveLength(3);
              const panels = renderer.rects.filter((r) => r.w > 100); // objective, badge, feedback (not letter slots)
              for (const heart of hearts) {
                expect(overlaps(heart, controls)).toBe(false);
                for (const panel of panels) expect(overlaps(heart, panel)).toBe(false);
              }
              for (const panel of panels) expect(overlaps(panel, controls)).toBe(false);
              const slots = renderer.rects.filter((r) => r.w <= 100);
              for (const slot of slots) {
                for (const heart of hearts) expect(overlaps(slot, heart)).toBe(false);
                for (const panel of panels) expect(overlaps(slot, panel)).toBe(false);
              }
              for (let i = 0; i < panels.length; i++) {
                for (let j = i + 1; j < panels.length; j++) expect(overlaps(panels[i], panels[j])).toBe(false);
              }
            });
          }
        }
      }
    }

    it('enlarges text when the world is shown smaller than 960 px', () => {
      const small = recordingRenderer();
      const full = recordingRenderer();
      new Hud(small, { viewport, safeArea: () => phoneArea(667, 3) }).draw(longModel());
      new Hud(full, { viewport, safeArea: () => phoneArea(960, 3) }).draw(longModel());
      const size = (r) => Number(/(\d+)px/.exec(r.texts.find((t) => t.text === 'Monte a palavra: PAPAI').font)[1]);
      expect(size(small)).toBeGreaterThan(size(full));
      // ~18 CSS px on the 667 px screen.
      expect(size(small) * (667 / 960)).toBeGreaterThanOrEqual(17.5);
    });

    it('keeps HUD text inside the device safe areas', () => {
      const renderer = recordingRenderer();
      const area = { ...phoneArea(667, 3), left: 40, right: 40, top: 20 };
      const model = longModel();
      model.setTargetPointer({ direction: 'right', label: 'P' });
      new Hud(renderer, { viewport, safeArea: () => area }).draw(model);
      const level = renderer.texts.find((t) => t.text.startsWith('Fase:'));
      expect(level.x).toBeGreaterThanOrEqual(40);
      for (const rect of renderer.rects) {
        expect(rect.x).toBeGreaterThanOrEqual(40);
        expect(rect.x + rect.w).toBeLessThanOrEqual(920);
        expect(rect.y).toBeGreaterThanOrEqual(20 - 3);
      }
    });
  });
});
