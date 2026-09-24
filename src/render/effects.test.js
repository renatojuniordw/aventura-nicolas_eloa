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

  it('spawns, updates, and draws floating texts', () => {
    const textCalls = [];
    const renderer = {
      worldFillRect: () => {},
      worldText: (...args) => textCalls.push(args),
    };

    const effects = new Effects();
    effects.spawnFloatingText(100, 200, '+10 Pontos!', '#5ec26a');
    expect(effects.count).toBe(1);

    const initialY = effects.floatingTexts[0].y;
    effects.update(0.1);
    expect(effects.floatingTexts[0].y).toBeLessThan(initialY);

    effects.draw(renderer);
    expect(textCalls).toHaveLength(1);
    expect(textCalls[0][0]).toBe('+10 Pontos!');

    for (let i = 0; i < 15; i += 1) effects.update(0.1);
    expect(effects.count).toBe(0);
  });
});

it('reduces decorative motion while preserving readable feedback', () => {
  let reduced = false;
  const effects = new Effects({ reducedMotion: () => reduced });
  effects.spawnConfetti(0, 0);
  effects.spawnFloatingText(100, 200, 'Muito bem!');
  reduced = true;
  effects.update(0.1);
  expect(effects.particles).toHaveLength(0);
  expect(effects.floatingTexts[0].y).toBe(200);
  effects.spawnPuff(0, 0);
  effects.spawnConfetti(0, 0);
  expect(effects.particles).toHaveLength(0);
});

describe('portal effects', () => {
  it('spawnRing sends particles outward evenly in every direction', () => {
    const effects = new Effects({ random: () => 0.5 });
    effects.spawnRing(100, 100, 8, '#6ee1ff', 200);

    expect(effects.count).toBe(8);
    const xs = effects.particles.map((p) => Math.sign(Math.round(p.vx)));
    expect(xs).toContain(1);
    expect(xs).toContain(-1);
    expect(effects.particles.every((p) => p.color === '#6ee1ff')).toBe(true);
  });

  it('spawnSuction starts particles away from the point and pulls them onto it', () => {
    const effects = new Effects({ random: () => 0.5, gravity: 900 });
    effects.spawnSuction(200, 200, 12, 100);

    for (const p of effects.particles) {
      expect(Math.hypot(p.x - 200, p.y - 200)).toBeGreaterThan(50);
    }
    // Run to the end of their life: they converge on the centre.
    for (let i = 0; i < 10; i += 1) effects.update(0.05);
    for (const p of effects.particles) {
      expect(Math.hypot(p.x - 200, p.y - 200)).toBeLessThan(15);
    }
  });

  it('skips both when reduced motion is on', () => {
    const effects = new Effects({ reducedMotion: () => true });
    effects.spawnRing(0, 0);
    effects.spawnSuction(0, 0);
    expect(effects.count).toBe(0);
  });
});
