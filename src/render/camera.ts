import { CAMERA, VIEWPORT, type Viewport } from '../core/config.js';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface CameraOptions {
  viewport?: Viewport;
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
  maxX: number;
  smoothing: number;
  x: number;
  y: number;

  constructor({ viewport = VIEWPORT, maxX = 0, startX = 0, smoothing = CAMERA.smoothing }: CameraOptions = {}) {
    this.viewport = viewport;
    this.maxX = Math.max(0, maxX);
    this.smoothing = smoothing;
    this.x = clamp(startX, 0, this.maxX);
    this.y = 0;
  }

  /** World point -> position on the canvas. */
  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: x - this.x, y: y - this.y };
  }

  /** Ease the camera toward the player. */
  follow(target: FollowTarget): number {
    const restPoint = target.x + target.w / 2 - this.viewport.width * CAMERA.deadZoneRatio;
    this.x = clamp(this.x + (restPoint - this.x) * this.smoothing, 0, this.maxX);
    return this.x;
  }

  /** Jump straight to the target without easing (level start, respawn). */
  snapTo(target: FollowTarget): number {
    const restPoint = target.x + target.w / 2 - this.viewport.width * CAMERA.deadZoneRatio;
    this.x = clamp(restPoint, 0, this.maxX);
    return this.x;
  }
}
