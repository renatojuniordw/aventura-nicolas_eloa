/**
 * Animates a 2x2 sprite sheet (like celebrate pose) on an HTML5 canvas.
 *
 * Stays a plain, synchronous, framework-agnostic function rather than a React
 * component: it is unit-tested (`celebration-canvas.test.js` /
 * `.dom.test.js`) by calling it directly and asserting on the returned
 * `{canvas, stop}` synchronously (SSR-safe null canvas outside a DOM,
 * immediate rAF start, exact draw-call assertions) — behavior a
 * `useEffect`-based component can't offer synchronously. `ui/screens/main-menu.tsx`
 * wraps it in a small React component instead of porting its logic.
 */
export function createCelebrationCanvas(
  imageSrc: string,
  width = 120,
  height = 120,
): { canvas: HTMLCanvasElement | null; stop: () => void } {
  if (typeof document === 'undefined') return { canvas: null, stop: () => {} };

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.className = 'hero-celebrate-canvas';

  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return { canvas, stop: () => {} };

  const img = new Image();
  img.src = imageSrc;

  let frame = 0;
  let animId: number | null = null;
  let lastTime = 0;
  const frameDuration = 180; // ms per frame

  function step(time: number) {
    if (img.complete && img.naturalWidth > 0) {
      if (!lastTime || time - lastTime >= frameDuration) {
        lastTime = time;
        frame = (frame + 1) % 4; // 2x2 celebrate frame grid
      }
      const col = frame % 2;
      const row = Math.floor(frame / 2);
      const fw = img.naturalWidth / 2;
      const fh = img.naturalHeight / 2;

      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      ctx!.imageSmoothingEnabled = false;
      ctx!.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, canvas.width, canvas.height);
    }
    animId = requestAnimationFrame(step);
  }

  animId = requestAnimationFrame(step);

  return {
    canvas,
    stop: () => {
      if (animId) cancelAnimationFrame(animId);
    },
  };
}
