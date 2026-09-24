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

  it('tracks speedrun timer and progress', () => {
    const model = new HudModel({ isSpeedrun: true, timer: 12.5, speedrunProgress: '5/26' });
    expect(model.isSpeedrun).toBe(true);
    expect(model.timer).toBe(12.5);
    expect(model.speedrunProgress).toBe('5/26');

    model.setTimer(15.2);
    model.setSpeedrunProgress('6/26');
    expect(model.timer).toBe(15.2);
    expect(model.speedrunProgress).toBe('6/26');
  });

  it('exposes word board slots that fill in as letters are found', () => {
    const model = new HudModel();
    expect(model.boardSlots).toEqual([]);

    const letters = Array.from('REGADOR');
    model.setWordBoard(letters, 0);
    expect(model.boardSlots).toHaveLength(7);
    expect(model.boardSlots.every((slot) => !slot.revealed)).toBe(true);
    expect(model.boardSlots[0].isNext).toBe(true);

    model.setWordBoard(letters, 2);
    expect(model.boardSlots.map((slot) => slot.revealed)).toEqual([
      true, true, false, false, false, false, false,
    ]);
    expect(model.boardSlots[2].isNext).toBe(true);

    model.setWordBoard(letters, 99);
    expect(model.boardSlots.every((slot) => slot.revealed)).toBe(true);
    expect(model.boardSlots.some((slot) => slot.isNext)).toBe(false);
  });
});
