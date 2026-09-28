import { describe, expect, it } from 'vitest';
import { ControlsPractice, MOVE_HOLD_SECONDS, hintedActions, practiceText } from './controls-practice.js';
import { Actions } from '../input/actions.js';

const idle = { dt: 1 / 60, moveAxis: 0, jumped: false };

describe('ControlsPractice (docs/18 §8)', () => {
  it('walks through move → jump → combo → done on real actions only', () => {
    const practice = new ControlsPractice();
    expect(practice.step).toBe('move');

    // Time alone never advances a step.
    for (let i = 0; i < 600; i += 1) practice.update(idle);
    expect(practice.step).toBe('move');

    practice.update({ dt: MOVE_HOLD_SECONDS / 2, moveAxis: 1, jumped: false });
    practice.update({ dt: 0.1, moveAxis: 0, jumped: false });
    expect(practice.step).toBe('move');
    expect(practice.update({ dt: MOVE_HOLD_SECONDS / 2, moveAxis: -1, jumped: false })).toBe(true);
    expect(practice.step).toBe('jump');

    expect(practice.update({ ...idle, moveAxis: 1 })).toBe(false);
    practice.update({ ...idle, jumped: true });
    expect(practice.step).toBe('combo');

    // Jumping in place does not count as the combination.
    practice.update({ ...idle, jumped: true });
    expect(practice.step).toBe('combo');
    practice.update({ ...idle, moveAxis: 1, jumped: true });
    expect(practice.done).toBe(true);
    expect(practice.update({ ...idle, moveAxis: 1, jumped: true })).toBe(false);
  });

  it('can restart from the first step and reports progress', () => {
    const practice = new ControlsPractice();
    practice.update({ dt: 1, moveAxis: 1, jumped: false });
    expect(practice.stepNumber).toBe(2);
    expect(practice.totalSteps).toBe(3);
    practice.restart();
    expect(practice.step).toBe('move');
    expect(practice.stepNumber).toBe(1);
  });

  it('points at the buttons each step teaches', () => {
    expect(hintedActions('move')).toEqual([Actions.MOVE_LEFT, Actions.MOVE_RIGHT]);
    expect(hintedActions('jump')).toEqual([Actions.JUMP]);
    expect(hintedActions('combo')).toHaveLength(3);
    expect(hintedActions('done')).toEqual([]);
  });

  it('words each step for touch or keyboard, keeping sustained jump as a later tip', () => {
    expect(practiceText('move', true).body).toContain('◀');
    expect(practiceText('move', false).body).toContain('←');
    expect(practiceText('jump', false).body).toContain('Espaço');
    expect(practiceText('done', true).body).toContain('mais alto');
    expect(practiceText('jump', true).body).not.toContain('mais alto');
  });
});
