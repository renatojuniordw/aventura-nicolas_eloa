import type { HudSafeArea } from '../render/hud.js';

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Pure conversion from page measurements (CSS px) to the Canvas HUD's free
 * area (canvas units). Exported for tests; `createHudSafeArea` feeds it.
 *
 * `xCanvas = (xCSS - canvasLeft) × canvas.width / canvasRect.width`, and the
 * vertical equivalent. Safe-area insets only count where they reach into the
 * canvas (a letterboxed canvas may already sit clear of the notch).
 */
export function computeHudSafeArea({
  canvas,
  canvasSize,
  controls,
  insets,
  page,
}: {
  canvas: Rect;
  canvasSize: { width: number; height: number };
  controls: Rect | null;
  insets: Insets;
  page: { width: number; height: number };
}): HudSafeArea | null {
  if (!(canvas.width > 0) || !(canvas.height > 0)) return null;
  const sx = canvasSize.width / canvas.width;
  const sy = canvasSize.height / canvas.height;
  const toX = (x: number) => (x - canvas.left) * sx;
  const toY = (y: number) => (y - canvas.top) * sy;

  let box: HudSafeArea['controls'] = null;
  if (controls && controls.width > 0 && controls.height > 0) {
    const left = toX(controls.left);
    const bottom = toY(controls.bottom);
    if (left < canvasSize.width && bottom > 0) box = { left: Math.max(0, left), bottom };
  }

  return {
    top: Math.max(0, insets.top - canvas.top) * sy,
    left: Math.max(0, insets.left - canvas.left) * sx,
    right: Math.max(0, insets.right - (page.width - canvas.right)) * sx,
    controls: box,
    displayScale: canvas.width / canvasSize.width,
  };
}

/**
 * Measures the real layout so the Canvas HUD never sits under the DOM
 * buttons or a notch: reads the `.hud-controls-bar` box, the canvas box and
 * `env(safe-area-inset-*)`, converts them to canvas units, and caches the
 * result. It re-measures on resize/rotation and when the buttons change
 * (never per frame).
 */
export function createHudSafeArea({
  canvas,
  controlsRoot,
}: {
  canvas: HTMLCanvasElement;
  controlsRoot: HTMLElement;
}): { read: () => HudSafeArea | null; refresh: () => void; dispose: () => void } {
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:fixed;inset:0;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
  document.body.append(probe);

  let cached: HudSafeArea | null = null;
  let dirty = true;

  const measure = () => {
    const style = getComputedStyle(probe);
    const px = (value: string) => Number.parseFloat(value) || 0;
    const bar = controlsRoot.querySelector<HTMLElement>('.hud-controls-bar');
    cached = computeHudSafeArea({
      canvas: canvas.getBoundingClientRect(),
      canvasSize: { width: canvas.width, height: canvas.height },
      controls: bar ? bar.getBoundingClientRect() : null,
      insets: {
        top: px(style.paddingTop),
        right: px(style.paddingRight),
        bottom: px(style.paddingBottom),
        left: px(style.paddingLeft),
      },
      page: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
    });
    dirty = false;
  };
  const invalidate = () => {
    dirty = true;
  };

  window.addEventListener('resize', invalidate);
  window.addEventListener('orientationchange', invalidate);
  window.visualViewport?.addEventListener('resize', invalidate);
  const mutations = typeof MutationObserver === 'function' ? new MutationObserver(invalidate) : null;
  mutations?.observe(controlsRoot, { childList: true, subtree: true });
  const sizes = typeof ResizeObserver === 'function' ? new ResizeObserver(invalidate) : null;
  sizes?.observe(controlsRoot);
  sizes?.observe(canvas);

  return {
    read: () => {
      if (dirty) measure();
      return cached;
    },
    refresh: invalidate,
    dispose: () => {
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('orientationchange', invalidate);
      window.visualViewport?.removeEventListener('resize', invalidate);
      mutations?.disconnect();
      sizes?.disconnect();
      probe.remove();
    },
  };
}
