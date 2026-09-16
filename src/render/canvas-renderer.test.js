import { describe, it, expect, vi } from 'vitest';
import { CanvasRenderer } from './canvas-renderer.js';

/**
 * Branch coverage for the only module that talks to the Canvas 2D context.
 * A recording fake context proves the camera transform, the flipX mirror path
 * and the screen-space helpers, none of which the integration smoke test
 * asserts on.
 */
function createCtx() {
  return {
    imageSmoothingEnabled: true,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    roundRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
  };
}

function createRenderer() {
  const ctx = createCtx();
  const canvas = { width: 960, height: 540, getContext: () => ctx };
  return { renderer: new CanvasRenderer(canvas), ctx };
}

describe('CanvasRenderer', () => {
  it('reads canvas size and disables image smoothing on construction', () => {
    const { renderer, ctx } = createRenderer();

    expect(renderer.width).toBe(960);
    expect(renderer.height).toBe(540);
    expect(renderer.camera).toEqual({ x: 0, y: 0 });
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('setCamera stores the world offset and defaults y to 0', () => {
    const { renderer } = createRenderer();

    renderer.setCamera(120);
    expect(renderer.camera).toEqual({ x: 120, y: 0 });

    renderer.setCamera(30, 15);
    expect(renderer.camera).toEqual({ x: 30, y: 15 });
  });

  it('clear resets the transform then fills the full screen rect', () => {
    const { renderer, ctx } = createRenderer();

    renderer.clear('#123456');

    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 960, 540);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it('worldFillRect offsets by the camera and rounds to whole pixels', () => {
    const { renderer, ctx } = createRenderer();
    renderer.setCamera(10, 4);

    renderer.worldFillRect(100.4, 50.6, 32, 48, '#fff');

    expect(ctx.fillRect).toHaveBeenCalledWith(90, 47, 32, 48);
  });

  it('worldStrokeRect applies the half-pixel inset for crisp lines', () => {
    const { renderer, ctx } = createRenderer();
    renderer.setCamera(5, 0);

    renderer.worldStrokeRect(20, 10, 40, 20, '#000', 3);

    expect(ctx.lineWidth).toBe(3);
    expect(ctx.strokeRect).toHaveBeenCalledWith(15.5, 10.5, 39, 19);
  });

  it('worldText draws with the camera offset and middle baseline', () => {
    const { renderer, ctx } = createRenderer();
    renderer.setCamera(7);

    renderer.worldText('A', 100, 200, { color: '#f00', font: '12px monospace', align: 'left' });

    expect(ctx.fillStyle).toBe('#f00');
    expect(ctx.font).toBe('12px monospace');
    expect(ctx.textAlign).toBe('left');
    expect(ctx.textBaseline).toBe('middle');
    expect(ctx.fillText).toHaveBeenCalledWith('A', 93, 200);
  });

  it('worldImage draws directly without a transform when flipX is false', () => {
    const { renderer, ctx } = createRenderer();
    renderer.setCamera(4, 2);

    renderer.worldImage('img', 1, 2, 3, 4, 10, 20, 30, 40);

    expect(ctx.drawImage).toHaveBeenCalledWith('img', 1, 2, 3, 4, 6, 18, 30, 40);
    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.scale).not.toHaveBeenCalled();
  });

  it('worldImage mirrors around the destination rect when flipX is true', () => {
    const { renderer, ctx } = createRenderer();
    renderer.setCamera(4, 2);

    renderer.worldImage('img', 1, 2, 3, 4, 10, 20, 30, 40, { flipX: true });

    expect(ctx.translate).toHaveBeenCalledWith(36, 18);
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    expect(ctx.drawImage).toHaveBeenCalledWith('img', 1, 2, 3, 4, 0, 0, 30, 40);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it('screen-space helpers ignore the camera', () => {
    const { renderer, ctx } = createRenderer();
    renderer.setCamera(999, 999);

    renderer.screenFillRect(1, 2, 3, 4, '#abc');
    renderer.screenCircle(10, 20, 5, '#def');
    renderer.screenText('oi', 30, 40, { color: '#111', align: 'right', baseline: 'top' });
    renderer.screenRoundRect(5, 6, 7, 8, 2, '#222');
    renderer.screenImage('img', 50, 60, 70, 80);

    expect(ctx.fillRect).toHaveBeenCalledWith(1, 2, 3, 4);
    expect(ctx.arc).toHaveBeenCalledWith(10, 20, 5, 0, Math.PI * 2);
    expect(ctx.fillText).toHaveBeenCalledWith('oi', 30, 40);
    expect(ctx.textAlign).toBe('right');
    expect(ctx.textBaseline).toBe('top');
    expect(ctx.roundRect).toHaveBeenCalledWith(5, 6, 7, 8, 2);
    expect(ctx.drawImage).toHaveBeenCalledWith('img', 50, 60, 70, 80);
  });
});