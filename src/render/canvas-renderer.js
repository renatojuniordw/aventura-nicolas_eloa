/**
 * The single place that talks to the Canvas 2D context.
 *
 * Everything else draws through this thin API, which keeps `ctx` calls out of
 * gameplay code and makes the world/screen transform explicit:
 *
 *   renderer.setCamera(x, y)   // world offset
 *   renderer.fillRect(...)     // world coordinates
 *   renderer.screenRect(...)   // HUD, ignores the camera
 */
export class CanvasRenderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.camera = { x: 0, y: 0 };
    this.ctx.imageSmoothingEnabled = false;
  }

  setCamera(x, y = 0) {
    this.camera.x = x;
    this.camera.y = y;
  }

  /** Wipe the canvas with a solid colour (screen space). */
  clear(color) {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }

  // --- World space (affected by the camera) --------------------------------

  worldFillRect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x - this.camera.x), Math.round(y - this.camera.y), w, h);
  }

  worldStrokeRect(x, y, w, h, color, lineWidth = 2) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(
      Math.round(x - this.camera.x) + 0.5,
      Math.round(y - this.camera.y) + 0.5,
      w - 1,
      h - 1,
    );
  }

  worldText(text, x, y, { color = '#000', font = '20px sans-serif', align = 'center' } = {}) {
    this.ctx.fillStyle = color;
    this.ctx.font = font;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, Math.round(x - this.camera.x), Math.round(y - this.camera.y));
  }

  /**
   * Draw a sprite frame from an atlas. Pass `flipX: true` to mirror the frame
   * horizontally around its own destination rect (used for facing direction).
   */
  worldImage(image, sx, sy, sw, sh, dx, dy, dw, dh, { flipX = false } = {}) {
    const screenX = dx - this.camera.x;
    const screenY = dy - this.camera.y;
    if (!flipX) {
      this.ctx.drawImage(image, sx, sy, sw, sh, screenX, screenY, dw, dh);
      return;
    }
    this.ctx.save();
    this.ctx.translate(screenX + dw, screenY);
    this.ctx.scale(-1, 1);
    this.ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
    this.ctx.restore();
  }

  // --- Screen space (HUD, overlays drawn on canvas) -------------------------

  screenFillRect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  screenCircle(x, y, radius, color) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  screenText(text, x, y, { color = '#fff', font = '20px sans-serif', align = 'center', baseline = 'middle' } = {}) {
    this.ctx.fillStyle = color;
    this.ctx.font = font;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.fillText(text, x, y);
  }

  screenRoundRect(x, y, w, h, radius, color) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, radius);
    this.ctx.fill();
  }

  screenImage(image, dx, dy, dw, dh) {
    this.ctx.drawImage(image, dx, dy, dw, dh);
  }
}
