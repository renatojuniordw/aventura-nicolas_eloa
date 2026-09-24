import { describe, expect, it } from 'vitest';
import { DiscoveryRun } from './discovery-run.js';

const BALL = { id: 'bola', label: 'BOLA', x: 20, y: 20, w: 30, h: 30 };

describe('DiscoveryRun', () => {
  it('activates an object once per contact and allows repeating after leaving', () => {
    const run = new DiscoveryRun([BALL]);
    const player = { x: 25, y: 25, w: 10, h: 10 };

    expect(run.update(player, 0.1)).toBe(BALL);
    expect(run.update(player, 2)).toBeNull();
    run.update({ x: 200, y: 200, w: 10, h: 10 }, 0.1);
    expect(run.update(player, 2)).toBe(BALL);
  });

  it('never requires an order or marks an answer wrong', () => {
    const flower = { id: 'flor', label: 'FLOR', x: 100, y: 20, w: 30, h: 30 };
    const run = new DiscoveryRun([BALL, flower]);

    expect(run.update({ x: 105, y: 25, w: 10, h: 10 }, 0.1)).toBe(flower);
    expect(run.active).toBe(flower);
  });
});
