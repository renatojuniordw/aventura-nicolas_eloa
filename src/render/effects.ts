import type { CanvasRenderer } from './canvas-renderer.js';

/**
 * Lightweight particle effects (confetti on a correct answer / level clear).
 *
 * Pure simulation of a particle list — no canvas access — so the lifecycle
 * (birth, fall, fade, removal) is unit-testable. `draw` is the only method
 * that touches the renderer.
 */

const CONFETTI_COLORS = ['#ffcc4d', '#ff5d73', '#3f8efc', '#5ec26a', '#b06bd6', '#ffffff'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

interface EffectsOptions {
  random?: () => number;
  gravity?: number;
  reducedMotion?: () => boolean;
}

export class Effects {
  particles: Particle[] = [];
  floatingTexts: FloatingText[] = [];
  private _random: () => number;
  private _gravity: number;
  private _reducedMotion: () => boolean;

  constructor({ random = Math.random, gravity = 900, reducedMotion = () => false }: EffectsOptions = {}) {
    this._random = random;
    this._gravity = gravity;
    this._reducedMotion = reducedMotion;
  }

  get count(): number {
    return this.particles.length + this.floatingTexts.length;
  }

  clear(): void {
    this.particles = [];
    this.floatingTexts = [];
  }

  /** Spawns a floating score or praise text that rises smoothly. */
  spawnFloatingText(x: number, y: number, text: string, color = '#ffd479'): void {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: this._reducedMotion() ? 0 : -55,
      life: 0.9,
      maxLife: 0.9,
      color,
    });
  }

  /** Celebration burst centered on a world position. */
  spawnConfetti(x: number, y: number, count = 48): void {
    if (this._reducedMotion()) return;
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
  spawnPuff(x: number, y: number, count = 12, color = '#ffcc4d'): void {
    if (this._reducedMotion()) return;
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

  /** Even ring of particles expanding from a point (portal opening). */
  spawnRing(x: number, y: number, count = 28, color = '#6ee1ff', speed = 220): void {
    if (this._reducedMotion()) return;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - this._gravity * 0.25,
        life: 0.7 + this._random() * 0.3,
        maxLife: 1,
        size: 4 + Math.floor(this._random() * 3),
        color,
      });
    }
  }

  /** Particles that start on a circle and spiral in to a point (being pulled into the portal). */
  spawnSuction(x: number, y: number, count = 24, radius = 90, color = '#b9f2ff'): void {
    if (this._reducedMotion()) return;
    const life = 0.55;
    for (let i = 0; i < count; i += 1) {
      const angle = this._random() * Math.PI * 2;
      const dist = radius * (0.6 + this._random() * 0.4);
      this.particles.push({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        // Straight to the centre within `life`; gravity is cancelled by the upward bias.
        vx: (-Math.cos(angle) * dist) / life,
        vy: (-Math.sin(angle) * dist) / life - (this._gravity * life) / 2,
        life,
        maxLife: life,
        size: 3 + Math.floor(this._random() * 3),
        color,
      });
    }
  }

  update(dt: number): void {
    if (this._reducedMotion()) {
      this.particles = [];
      for (const text of this.floatingTexts) text.vy = 0;
    }
    for (const particle of this.particles) {
      particle.vy += this._gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);

    for (const text of this.floatingTexts) {
      text.y += text.vy * dt;
      text.life -= dt;
    }
    this.floatingTexts = this.floatingTexts.filter((text) => text.life > 0);
  }

  draw(renderer: CanvasRenderer): void {
    for (const particle of this.particles) {
      // Fade out as life runs out, by shrinking the drawn square.
      const ratio = Math.max(0, Math.min(1, particle.life / particle.maxLife));
      const size = Math.max(2, Math.round(particle.size * (0.4 + ratio * 0.6)));
      renderer.worldFillRect(particle.x, particle.y, size, size, particle.color);
    }

    for (const text of this.floatingTexts) {
      renderer.worldText?.(text.text, text.x, text.y, {
        color: text.color,
        font: 'bold 15px sans-serif',
        align: 'center',
      });
    }
  }
}
