import { describe, it, expect, vi } from 'vitest';
import { LevelManager } from './level-manager.js';
import { EventBus, Events } from '../core/event-bus.js';

const LEVEL = {
  worldWidth: 1000,
  worldHeight: 500,
  checkpoint: { x: 50, y: 400 },
  items: [
    { id: 'target', type: 'target', label: 'A', x: 100, y: 100, w: 32, h: 32 },
    { id: 'other', type: 'distractor', label: 'B', x: 300, y: 100, w: 32, h: 32 },
  ],
  hazards: [{ id: 'spikes', x: 600, y: 400, w: 64, h: 32 }],
};

const body = (x, y) => ({ x, y, w: 30, h: 42 });

describe('LevelManager', () => {
  it('emits ITEM_COLLECTED once per item', () => {
    const bus = new EventBus();
    const onCollected = vi.fn();
    bus.on(Events.ITEM_COLLECTED, onCollected);
    const manager = new LevelManager({ level: LEVEL, bus });

    manager.update({ body: body(100, 100) });
    manager.update({ body: body(100, 100) });

    expect(onCollected).toHaveBeenCalledTimes(1);
    expect(onCollected.mock.calls[0][0].item.id).toBe('target');
    expect(manager.targetCollected).toBe(true);
  });

  it('keeps counting remaining items', () => {
    const manager = new LevelManager({ level: LEVEL });
    expect(manager.remainingItems).toBe(2);
    manager.update({ body: body(100, 100) });
    expect(manager.remainingItems).toBe(1);
  });

  it('does not report the target before it is collected', () => {
    const manager = new LevelManager({ level: LEVEL });
    manager.update({ body: body(300, 100) }); // collects the distractor
    expect(manager.targetCollected).toBe(false);
  });

  it('emits HAZARD_HIT only when entering the hazard', () => {
    const bus = new EventBus();
    const onHazard = vi.fn();
    bus.on(Events.HAZARD_HIT, onHazard);
    const manager = new LevelManager({ level: LEVEL, bus });

    manager.update({ body: body(600, 400) });
    manager.update({ body: body(600, 400) });
    expect(onHazard).toHaveBeenCalledTimes(1);

    // Leaving and re-entering counts as a new hit.
    manager.update({ body: body(0, 0) });
    manager.update({ body: body(600, 400) });
    expect(onHazard).toHaveBeenCalledTimes(2);
  });

  it('emits PLAYER_FELL once until the player is back in the world', () => {
    const bus = new EventBus();
    const onFell = vi.fn();
    bus.on(Events.PLAYER_FELL, onFell);
    const manager = new LevelManager({ level: LEVEL, bus });

    manager.update({ body: body(100, 900) });
    manager.update({ body: body(100, 900) });
    expect(onFell).toHaveBeenCalledTimes(1);

    manager.resetTransientState();
    manager.update({ body: body(100, 900) });
    expect(onFell).toHaveBeenCalledTimes(2);
  });

  it('respawns at the level checkpoint and keeps collected items', () => {
    const manager = new LevelManager({ level: LEVEL });
    manager.update({ body: body(100, 100) });
    expect(manager.getRespawnPoint()).toEqual({ x: 50, y: 400 });
    manager.resetTransientState();
    expect(manager.targetCollected).toBe(true);
  });

  it('works without an event bus (defensive default)', () => {
    const manager = new LevelManager({ level: LEVEL });
    expect(() => manager.update({ body: body(0, 0) })).not.toThrow();
  });
});
