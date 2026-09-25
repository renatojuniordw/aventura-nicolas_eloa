import { CAMERA, VIEWPORT, type Viewport } from '../core/config.js';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface CameraOptions {
  viewport?: Viewport;
  minX?: number;
  maxX?: number;
  startX?: number;
  smoothing?: number;
}

interface FollowTarget {
  x: number;
  w: number;
}

/**
 * Horizontal follow camera. Pure transform math plus a small state holder, so
 * the behaviour is unit-testable without a canvas.
 */
export class Camera {
  viewport: Viewport;
  /** Left limit: an endless world raises it as old ground is dropped behind the player. */
  minX: number;
  maxX: number;
  smoothing: number;
  x: number;
  y: number;

  constructor({ viewport = VIEWPORT, minX = 0, maxX = 0, startX = 0, smoothing = CAMERA.smoothing }: CameraOptions = {}) {
    this.viewport = viewport;
    this.minX = Math.max(0, minX);
    this.maxX = Math.max(0, maxX);
    this.smoothing = smoothing;
    this.x = this._clamp(startX);
    this.y = 0;
  }

  private _clamp(x: number): number {
    return clamp(x, this.minX, Math.max(this.minX, this.maxX));
  }

  /** World point -> position on the canvas. */
  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: x - this.x, y: y - this.y };
  }

  /** Ease the camera toward the player. */
  follow(target: FollowTarget): number {
    const restPoint = target.x + target.w / 2 - this.viewport.width * CAMERA.deadZoneRatio;
    this.x = this._clamp(this.x + (restPoint - this.x) * this.smoothing);
    return this.x;
  }

  /** Jump straight to the target without easing (level start, respawn). */
  snapTo(target: FollowTarget): number {
    const restPoint = target.x + target.w / 2 - this.viewport.width * CAMERA.deadZoneRatio;
    this.x = this._clamp(restPoint);
    return this.x;
  }
}
