/**
 * Animates a 2x2 sprite sheet (like celebrate pose) on an HTML5 canvas.
 * Extracted from `main-menu.js` so the menu builder keeps a single
 * responsibility (DOM composition); canvas animation lives here.
 * @param {string} imageSrc
 * @param {number} width
 * @param {number} height
 * @returns {{ canvas: HTMLCanvasElement|null, stop: () => void }}
 */
export function createCelebrationCanvas(imageSrc, width = 120, height = 120) {
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
  let animId = null;
  let lastTime = 0;
  const frameDuration = 180; // ms per frame

  function step(time) {
    if (img.complete && img.naturalWidth > 0) {
      if (!lastTime || time - lastTime >= frameDuration) {
        lastTime = time;
        frame = (frame + 1) % 4; // 2x2 celebrate frame grid
      }
      const col = frame % 2;
      const row = Math.floor(frame / 2);
      const fw = img.naturalWidth / 2;
      const fh = img.naturalHeight / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, canvas.width, canvas.height);
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
