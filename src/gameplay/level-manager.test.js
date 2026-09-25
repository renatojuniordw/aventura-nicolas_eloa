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
  it('collects an item the body only barely misses (forgiving pickup margin)', () => {
    const manager = new LevelManager({ level: LEVEL });
    // Body bottom is 8px above the item's top edge: a plain overlap would miss.
    manager.update({ body: body(100, 100 - 42 - 8) });
    expect(manager.collected.has('target')).toBe(true);
  });

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

  it('advances the respawn point via setCheckpoint without touching the level object', () => {
    const frozenLevel = Object.freeze({ ...LEVEL, checkpoint: Object.freeze({ x: 50, y: 400 }) });
    const manager = new LevelManager({ level: frozenLevel });

    manager.setCheckpoint({ x: 900, y: 300 });

    expect(manager.getRespawnPoint()).toEqual({ x: 900, y: 300 });
    expect(frozenLevel.checkpoint).toEqual({ x: 50, y: 400 });
  });

  it('works without an event bus (defensive default)', () => {
    const manager = new LevelManager({ level: LEVEL });
    expect(() => manager.update({ body: body(0, 0) })).not.toThrow();
  });

  describe('portal', () => {
    const portalLevel = (overrides = {}) => ({ ...LEVEL, finish: { x: 800, y: 364 }, portalActive: true, ...overrides });

    it('emits PORTAL_ENTERED once when the player reaches an active portal', () => {
      const bus = new EventBus();
      const onPortal = vi.fn();
      bus.on(Events.PORTAL_ENTERED, onPortal);
      const manager = new LevelManager({ level: portalLevel(), bus });

      manager.update({ body: body(700, 364) });
      expect(onPortal).not.toHaveBeenCalled();

      manager.update({ body: body(810, 364) });
      manager.update({ body: body(820, 364) });
      expect(onPortal).toHaveBeenCalledTimes(1);
    });

    it('ignores a portal that is not active yet, even at its position', () => {
      const bus = new EventBus();
      const onPortal = vi.fn();
      bus.on(Events.PORTAL_ENTERED, onPortal);
      const manager = new LevelManager({ level: portalLevel({ portalActive: false }), bus });

      manager.update({ body: body(810, 364) });
      expect(onPortal).not.toHaveBeenCalled();
    });

    it('notices a portal that becomes active after the manager was created', () => {
      const bus = new EventBus();
      const onPortal = vi.fn();
      bus.on(Events.PORTAL_ENTERED, onPortal);
      const level = portalLevel({ portalActive: false });
      const manager = new LevelManager({ level, bus });

      manager.update({ body: body(810, 364) });
      level.portalActive = true;
      manager.update({ body: body(810, 364) });
      expect(onPortal).toHaveBeenCalledTimes(1);
    });
  });

  it('never counts remaining items below zero when the world withdraws collected ones', () => {
    const level = { ...LEVEL, items: [...LEVEL.items] };
    const manager = new LevelManager({ level });
    manager.update({ body: body(100, 100) });
    level.items = level.items.filter((item) => item.id !== 'target');
    expect(manager.remainingItems).toBe(1);
    level.items = [];
    expect(manager.remainingItems).toBe(0);
  });

  it('forgets collected ids once their items leave the world', () => {
    const level = { ...LEVEL, items: [...LEVEL.items] };
    const manager = new LevelManager({ level });
    manager.update({ body: body(100, 100) });
    expect(manager.collected.has('target')).toBe(true);
    level.items = level.items.filter((item) => item.id !== 'target');
    manager.pruneCollected();
    expect(manager.collected.size).toBe(0);
  });

  it('does not collect an item that a listener withdrew during the same frame', () => {
    const bus = new EventBus();
    const level = {
      ...LEVEL,
      items: [
        { id: 'a', type: 'target', label: 'A', x: 100, y: 100, w: 32, h: 32 },
        { id: 'b', type: 'distractor', label: 'B', x: 110, y: 100, w: 32, h: 32 },
      ],
    };
    const collected = [];
    bus.on(Events.ITEM_COLLECTED, ({ item }) => {
      collected.push(item.id);
      // Reacting to 'a' replaces the world's items (as setTarget does), dropping 'b'.
      level.items = level.items.filter((other) => other.id !== 'a' && other.id !== 'b');
    });
    const manager = new LevelManager({ level, bus });
    manager.update({ body: body(100, 100) });
    expect(collected).toEqual(['a']);
  });

  it('only takes the player into a fully grown portal', () => {
    const bus = new EventBus();
    const onPortal = vi.fn();
    bus.on(Events.PORTAL_ENTERED, onPortal);
    const level = { ...LEVEL, items: [], finish: { x: 400, y: 300 }, portalActive: true, portalReveal: 0.4 };
    const manager = new LevelManager({ level, bus });
    manager.update({ body: body(420, 320) });
    expect(onPortal).not.toHaveBeenCalled();
    level.portalReveal = 1;
    manager.update({ body: body(420, 320) });
    expect(onPortal).toHaveBeenCalledTimes(1);
  });
});

