/**
 * Lightweight particle effects (confetti on a correct answer / level clear).
 *
 * Pure simulation of a particle list — no canvas access — so the lifecycle
 * (birth, fall, fade, removal) is unit-testable. `draw` is the only method
 * that touches the renderer.
 */

const CONFETTI_COLORS = ['#ffcc4d', '#ff5d73', '#3f8efc', '#5ec26a', '#b06bd6', '#ffffff'];

export class Effects {
  /**
   * @param {{ random?: () => number, gravity?: number }} [options]
   */
  constructor({ random = Math.random, gravity = 900 } = {}) {
    this._random = random;
    this._gravity = gravity;
    /** @type {Array<object>} */
    this.particles = [];
  }

  get count() {
    return this.particles.length;
  }

  clear() {
    this.particles = [];
  }

  /** Celebration burst centered on a world position. */
  spawnConfetti(x, y, count = 48) {
    for (let i = 0; i < count; i += 1) {
      const angle = this._random() * Math.PI * 2;
      const speed = 120 + this._random() * 260;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 220,
        life: 0.9 + this._random() * 0.8,
        maxLife: 1.7,
        size: 4 + Math.floor(this._random() * 5),
        color: CONFETTI_COLORS[Math.floor(this._random() * CONFETTI_COLORS.length)],
      });
    }
  }

  /** Small puff used when an item is collected. */
  spawnPuff(x, y, count = 12, color = '#ffcc4d') {
    for (let i = 0; i < count; i += 1) {
      const angle = this._random() * Math.PI * 2;
      const speed = 40 + this._random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + this._random() * 0.3,
        maxLife: 0.7,
        size: 3 + Math.floor(this._random() * 4),
        color,
      });
    }
  }

  update(dt) {
    for (const particle of this.particles) {
      particle.vy += this._gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  /** @param {import('./canvas-renderer.js').CanvasRenderer} renderer */
  draw(renderer) {
    for (const particle of this.particles) {
      // Fade out as life runs out, by shrinking the drawn square.
      const ratio = Math.max(0, Math.min(1, particle.life / particle.maxLife));
      const size = Math.max(2, Math.round(particle.size * (0.4 + ratio * 0.6)));
      renderer.worldFillRect(particle.x, particle.y, size, size, particle.color);
    }
  }
}
