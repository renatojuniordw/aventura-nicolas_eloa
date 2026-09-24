import type { CanvasRenderer } from './canvas-renderer.js';
import type { DiscoveryRun } from '../gameplay/discovery-run.js';

export function drawDiscoveries(renderer: CanvasRenderer, run: DiscoveryRun, reducedMotion: boolean): void {
  for (const item of run.objects) {
    const center = item.x + item.w / 2;
    const animated = item.id === run.active?.id && run.animation > 0;
    const bounce = animated && !reducedMotion ? Math.abs(Math.sin(run.animation * 10)) * 28 : 0;
    renderer.worldFillRect(item.x, 456, item.w, 8, animated ? '#ffd479' : '#326855');
    renderer.worldText(item.icon, center, 407 - bounce, { font: '54px "Apple Color Emoji", "Segoe UI Emoji", sans-serif' });
    const font = 'bold 20px "Trebuchet MS", sans-serif';
    const width = renderer.measureText(item.label, font) + 20;
    renderer.worldFillRect(center - width / 2, 328, width, 30, '#fbf4df');
    renderer.worldText(item.label, center, 343, { color: '#233d38', font });
  }
}
