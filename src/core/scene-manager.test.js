import { describe, it, expect, vi } from 'vitest';
import { SceneManager } from './scene-manager.js';
import { Scene } from './scene.js';
import { EventBus, Events } from './event-bus.js';

function makeSceneClass(log) {
  return class TestScene extends Scene {
    enter(params) {
      log.push(['enter', params]);
    }
    exit() {
      log.push(['exit']);
    }
    update(dt) {
      log.push(['update', dt]);
    }
    draw() {
      log.push(['draw']);
    }
  };
}

describe('SceneManager', () => {
  function setup() {
    const log = [];
    const bus = new EventBus();
    const manager = new SceneManager({}, bus);
    manager.register('a', makeSceneClass(log));
    manager.register('b', makeSceneClass(log));
    return { manager, bus, log };
  }

  it('enters the scene with params and exits the previous one', () => {
    const { manager, log } = setup();
    manager.switchTo('a', { id: 1 });
    manager.switchTo('b', { id: 2 });

    expect(log).toEqual([
      ['enter', { id: 1 }],
      ['exit'],
      ['enter', { id: 2 }],
    ]);
    expect(manager.currentName).toBe('b');
  });

  it('announces the new scene on the bus', () => {
    const { manager, bus } = setup();
    const onChange = vi.fn();
    bus.on(Events.SCENE_CHANGED, onChange);
    manager.switchTo('a');
    expect(onChange).toHaveBeenCalledWith({ name: 'a' });
  });

  it('delegates update and draw to the current scene', () => {
    const { manager, log } = setup();
    manager.switchTo('a');
    manager.update(1 / 60);
    manager.draw();
    expect(log).toContainEqual(['update', 1 / 60]);
    expect(log).toContainEqual(['draw']);
  });

  it('throws for an unregistered scene', () => {
    const { manager } = setup();
    expect(() => manager.switchTo('missing')).toThrow(/not registered/);
  });

  it('is safe to update before any scene is active', () => {
    const { manager } = setup();
    expect(() => manager.update(1 / 60)).not.toThrow();
    expect(manager.currentName).toBeNull();
  });
});
