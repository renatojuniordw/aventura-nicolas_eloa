import { describe, it, expect, vi } from 'vitest';
import { GameLoop } from './game-loop.js';

function makeLoop(overrides = {}) {
  const update = vi.fn();
  const render = vi.fn();
  const loop = new GameLoop({ update, render, ...overrides });
  return { loop, update, render };
}

describe('GameLoop', () => {
  it('runs one step for a single 1/60s delta', () => {
    const { loop, update } = makeLoop();
    const steps = loop.advance(1 / 60);
    expect(steps).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(1 / 60);
  });

  it('runs 30 steps for a 0.5s delta', () => {
    const { loop, update } = makeLoop({ maxSteps: 100 });
    const steps = loop.advance(0.5);
    expect(steps).toBe(30);
    expect(update).toHaveBeenCalledTimes(30);
  });

  it('clamps catch-up to maxSteps and drops the backlog', () => {
    const { loop, update } = makeLoop({ maxSteps: 5 });
    const steps = loop.advance(10);
    expect(steps).toBe(5);
    expect(update).toHaveBeenCalledTimes(5);
    // The remaining ~9.9s must be discarded, not carried over.
    expect(loop.advance(0)).toBe(0);
  });

  it('renders exactly once per advance regardless of step count', () => {
    const { loop, render } = makeLoop();
    loop.advance(0.5);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a sub-step delta but still renders', () => {
    const { loop, update, render } = makeLoop();
    const steps = loop.advance(1 / 120);
    expect(steps).toBe(0);
    expect(update).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('requires update and render callbacks', () => {
    expect(() => new GameLoop({ render: () => {} })).toThrow(TypeError);
    expect(() => new GameLoop({ update: () => {} })).toThrow(TypeError);
  });
});
