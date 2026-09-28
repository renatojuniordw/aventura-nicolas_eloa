import { POSE_FRAMES } from '../../content/atlas-meta.js';

interface CelebrationCanvasOptions {
  /** Effective reduced-motion rule (see ui/motion-policy.ts); defaults to the system preference. */
  reducedMotion?: () => boolean;
}

export interface CelebrationCanvasHandle {
  canvas: HTMLCanvasElement | null;
  /** Ends the animation for good: cancels the frame and removes every listener/observer. */
  stop: () => void;
  /** Re-reads `reducedMotion` (call it when the policy changes). */
  refresh: () => void;
}

/**
 * Animates the celebrate sprite sheet (grid from `POSE_FRAMES`) on an HTML5 canvas.
 *
 * Stays a plain, synchronous, framework-agnostic function rather than a React
 * component: it is unit-tested (`celebration-canvas.test.js` /
 * `.dom.test.js`) by calling it directly and asserting on the returned
 * handle synchronously (SSR-safe null canvas outside a DOM, immediate rAF
 * start, exact draw-call assertions) — behavior a `useEffect`-based component
 * can't offer synchronously. `ui/screens/main-menu.tsx` wraps it in a small
 * React component instead of porting its logic.
 *
 * Runs at most one rAF loop, and only while it is worth drawing (docs/18 §3):
 * the page is visible, the canvas is actually laid out on screen and motion is
 * not reduced. Layout visibility comes from an IntersectionObserver, so the
 * CSS breakpoints that hide the stage (`display: none`) are the only source of
 * truth — no JS copy of those media queries. With reduced motion it draws one
 * static frame (as soon as the sheet has loaded) and schedules nothing.
 */
export function createCelebrationCanvas(
  imageSrc: string,
  width = 120,
  height = 120,
  { reducedMotion }: CelebrationCanvasOptions = {},
): CelebrationCanvasHandle {
  const noop = () => {};
  if (typeof document === 'undefined') return { canvas: null, stop: noop, refresh: noop };

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.className = 'hero-celebrate-canvas';

  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return { canvas, stop: noop, refresh: noop };

  const systemMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const isReduced = reducedMotion ?? (() => Boolean(systemMotion?.matches));

  const img = new Image();
  const { columns, rows } = POSE_FRAMES.celebrate;
  let frame = 0;
  let animId: number | null = null;
  let lastTime = 0;
  let stopped = false;
  let pageVisible = document.visibilityState !== 'hidden';
  // Without IntersectionObserver (old browsers, jsdom) assume it is on screen.
  let onScreen = typeof IntersectionObserver === 'undefined';
  const frameDuration = 180; // ms per frame

  function ready(): boolean {
    return img.complete && img.naturalWidth > 0;
  }

  function draw(): void {
    const col = frame % columns;
    const row = Math.floor(frame / columns);
    const fw = img.naturalWidth / columns;
    const fh = img.naturalHeight / rows;
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    ctx!.imageSmoothingEnabled = false;
    ctx!.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, canvas.width, canvas.height);
  }

  function step(time: number) {
    animId = null;
    if (ready()) {
      if (!lastTime || time - lastTime >= frameDuration) {
        lastTime = time;
        frame = (frame + 1) % (columns * rows);
      }
      draw();
    }
    sync();
  }

  function cancel(): void {
    if (animId !== null) cancelAnimationFrame(animId);
    animId = null;
  }

  /** Starts or cancels the single loop to match the current state. */
  function sync(): void {
    if (stopped) return;
    if (isReduced()) {
      cancel();
      frame = 0;
      lastTime = 0;
      if (ready()) draw();
      return;
    }
    if (!pageVisible || !onScreen) {
      cancel();
      lastTime = 0;
      return;
    }
    if (animId === null) animId = requestAnimationFrame(step);
  }

  const onVisibility = () => {
    pageVisible = document.visibilityState !== 'hidden';
    sync();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const observer =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((entries) => {
          const entry = entries[entries.length - 1];
          if (!entry) return;
          onScreen = entry.isIntersecting;
          sync();
        });
  observer?.observe(canvas);

  // A late-loading sheet still gets its static frame under reduced motion.
  img.onload = () => sync();
  img.src = imageSrc;
  sync();

  return {
    canvas,
    stop: () => {
      stopped = true;
      cancel();
      img.onload = null;
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    },
    refresh: () => sync(),
  };
}
