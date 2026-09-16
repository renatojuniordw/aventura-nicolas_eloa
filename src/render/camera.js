import { CAMERA, VIEWPORT } from '../core/config.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Horizontal follow camera. Pure transform math plus a small state holder, so
 * the behaviour is unit-testable without a canvas.
 */
export class Camera {
  constructor({ viewport = VIEWPORT, maxX = 0, startX = 0, smoothing = CAMERA.smoothing } = {}) {
    this.viewport = viewport;
    this.maxX = Math.max(0, maxX);
    this.smoothing = smoothing;
    this.x = clamp(startX, 0, this.maxX);
    this.y = 0;
  }

  /** World point -> position on the canvas. */
  worldToScreen(x, y) {
    return { x: x - this.x, y: y - this.y };
  }

  /**
   * Ease the camera toward the player.
   * @param {{x:number,w:number}} target
   */
  follow(target) {
    const restPoint = target.x + target.w / 2 - this.viewport.width * CAMERA.deadZoneRatio;
    this.x = clamp(this.x + (restPoint - this.x) * this.smoothing, 0, this.maxX);
    return this.x;
  }

  /** Jump straight to the target without easing (level start, respawn). */
  snapTo(target) {
    const restPoint = target.x + target.w / 2 - this.viewport.width * CAMERA.deadZoneRatio;
    this.x = clamp(restPoint, 0, this.maxX);
    return this.x;
  }
}
