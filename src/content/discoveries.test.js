import { expect, it } from 'vitest';
import { DISCOVERIES, DISCOVERY_LEVEL } from './discoveries.js';
import { PlayerController } from '../gameplay/player/player-controller.js';
import { PhysicsEngine } from '../physics/physics-engine.js';
import { DiscoveryRun } from '../gameplay/discovery-run.js';

it('allows all discoveries to be reached, including by jumping onto raised paths', () => {
  const run = new DiscoveryRun(DISCOVERIES);
  for (const item of DISCOVERIES) {
    const player = new PlayerController({ x: item.x, y: 410, physics: new PhysicsEngine() });
    for (let frame = 0; frame < 60; frame++) player.update(1 / 60, DISCOVERY_LEVEL);
    if (item.y < 352) {
      player.holdJump(true);
      player.jump();
    }
    for (let frame = 0; frame < 120; frame++) {
      player.update(1 / 60, DISCOVERY_LEVEL);
      run.update(player.body, 1 / 60);
    }
    expect(run.discovered.has(item.id), item.id).toBe(true);
    expect(player.grounded, item.id).toBe(true);
    expect(player.body.y + player.body.h, item.id).toBe(item.y + item.h);
  }
  expect(run.discovered.size).toBe(DISCOVERIES.length);
});
