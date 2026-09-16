import { describe, it, expect } from 'vitest';
import { HudModel, FeedbackKind } from './hud-model.js';

describe('HudModel', () => {
  it('reports hearts left to right', () => {
    const model = new HudModel({ lives: 2, maxLives: 3 });
    expect(model.hearts).toEqual([true, true, false]);

    model.setLives(0);
    expect(model.hearts).toEqual([false, false, false]);
  });

  it('never goes below zero lives', () => {
    const model = new HudModel({ lives: 1 });
    model.setLives(-5);
    expect(model.lives).toBe(0);
  });

  it('shows feedback then hides it after the duration', () => {
    const model = new HudModel();
    model.showFeedback(FeedbackKind.CORRECT, 'Muito bem!', 1);
    expect(model.isFeedbackVisible).toBe(true);

    model.update(0.6);
    expect(model.isFeedbackVisible).toBe(true);

    model.update(0.5);
    expect(model.isFeedbackVisible).toBe(false);
    expect(model.feedback.kind).toBe(FeedbackKind.NONE);
  });

  it('starts with no feedback', () => {
    expect(new HudModel().isFeedbackVisible).toBe(false);
  });

  it('ignores update ticks when nothing is showing', () => {
    const model = new HudModel();
    model.update(1);
    expect(model.feedback.timer).toBe(0);
  });
});
