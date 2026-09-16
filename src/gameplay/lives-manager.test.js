import { describe, it, expect, vi } from 'vitest';
import { LivesManager } from './lives-manager.js';
import { EventBus, Events } from '../core/event-bus.js';

describe('LivesManager', () => {
  it('loses one heart at a time and announces the change', () => {
    const bus = new EventBus();
    const onChanged = vi.fn();
    bus.on(Events.LIVES_CHANGED, onChanged);
    const lives = new LivesManager({ lives: 3, bus });

    expect(lives.loseHeart()).toBe(true);
    expect(lives.lives).toBe(2);
    expect(onChanged).toHaveBeenLastCalledWith({ lives: 2, maxLives: 3 });
  });

  it('announces depletion exactly once at zero', () => {
    const bus = new EventBus();
    const onDepleted = vi.fn();
    bus.on(Events.LIVES_DEPLETED, onDepleted);
    const lives = new LivesManager({ lives: 2, bus });

    lives.loseHeart();
    lives.loseHeart();
    expect(lives.isDepleted).toBe(true);
    expect(onDepleted).toHaveBeenCalledTimes(1);

    // Further losses do nothing (and do not re-announce).
    expect(lives.loseHeart()).toBe(false);
    expect(onDepleted).toHaveBeenCalledTimes(1);
  });

  it('resets back to full hearts', () => {
    const lives = new LivesManager({ lives: 3 });
    lives.loseHeart();
    lives.loseHeart();
    lives.reset();
    expect(lives.lives).toBe(3);
    expect(lives.isDepleted).toBe(false);
  });

  it('never starts with more hearts than the maximum', () => {
    expect(new LivesManager({ lives: 10, maxLives: 3 }).lives).toBe(3);
  });
});
