import { describe, it, expect } from 'vitest';
import { Effects } from './effects.js';

/** Deterministic pseudo-random so particle tests are stable. */
function seeded(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

describe('Effects', () => {
  it('spawns the requested number of particles', () => {
    const effects = new Effects({ random: seeded([0.5, 0.25, 0.75]) });
    effects.spawnConfetti(100, 100, 20);
    expect(effects.count).toBe(20);
  });

  it('moves particles under gravity', () => {
    const effects = new Effects({ random: seeded([0.1, 0.5]), gravity: 1000 });
    effects.spawnPuff(0, 0, 1);
    const before = { x: effects.particles[0].x, y: effects.particles[0].y };
    effects.update(0.1);
    const after = effects.particles[0];
    expect(after.x).not.toBe(before.x);
    expect(after.vy).toBeGreaterThan(0);
  });

  it('removes particles once their life ends', () => {
    const effects = new Effects({ random: seeded([0.3, 0.4]) });
    effects.spawnPuff(0, 0, 5);
    expect(effects.count).toBe(5);
    for (let i = 0; i < 30; i += 1) effects.update(0.1);
    expect(effects.count).toBe(0);
  });

  it('clear empties the particle list', () => {
    const effects = new Effects({ random: seeded([0.2, 0.3]) });
    effects.spawnConfetti(0, 0, 10);
    effects.clear();
    expect(effects.count).toBe(0);
  });

  it('draws without a real canvas (injected NullRenderer)', () => {
    const calls = [];
    const renderer = { worldFillRect: (...args) => calls.push(args) };
    const effects = new Effects({ random: seeded([0.5, 0.5]) });
    effects.spawnConfetti(10, 10, 3);
    effects.draw(renderer);
    expect(calls).toHaveLength(3);
  });
});
