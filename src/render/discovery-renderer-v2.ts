import { DISCOVERY_AREAS } from '../content/discoveries.js';
import { drawDiscoveryPixels } from './discovery-pixels.js';
import type { CanvasRenderer } from './canvas-renderer.js';
import type { DiscoveryRun } from '../gameplay/discovery-run.js';

const rect = (r: CanvasRenderer, x: number, y: number, w: number, h: number, color: string) => r.worldFillRect(Math.round(x), Math.round(y), w, h, color);

function drawObject(r: CanvasRenderer, id: string, x: number, y: number, t: number, moving: boolean): void {
  const wave = moving ? Math.sin(t * 12) : 0;
  if (drawDiscoveryPixels(r, id, x, y, wave)) return;
  if (id === 'bola') {
    const lift = moving ? Math.abs(wave) * 30 : 0; const cy = y - lift;
    rect(r, x + 18, cy + 8, 36, 36, '#fff7df'); rect(r, x + 26, cy, 20, 52, '#fff7df'); rect(r, x + 14, cy + 16, 44, 20, '#fff7df');
    rect(r, x + 30, cy + 14, 12, 12, '#263d51'); rect(r, x + 20, cy + 28, 10, 8, '#e55b45'); rect(r, x + 43, cy + 27, 9, 10, '#e55b45'); return;
  }
  if (id === 'flor') {
    const sway = wave * 5; rect(r, x + 34, y + 25, 8, 38, '#397f4e'); rect(r, x + 20, y + 42, 18, 8, '#55a866');
    for (const [dx,dy] of [[20,4],[42,4],[12,20],[50,20],[20,34],[42,34]]) rect(r, x + dx + sway, y + dy, 16, 16, '#ffd447');
    rect(r, x + 28 + sway, y + 14, 22, 22, '#8f582b'); return;
  }
  if (id === 'arvore') {
    rect(r, x + 31, y + 22, 20, 52, '#81522f'); rect(r, x + 11, y + 2, 60, 35, '#397f4e'); rect(r, x + 22, y - 10, 38, 18, '#55a866');
    if (moving) { rect(r, x + 12, y + 35 + Math.abs(wave)*16, 7, 7, '#ffd447'); rect(r, x + 66, y + 24 + Math.abs(wave)*23, 7, 7, '#ffd447'); } return;
  }
  if (id === 'gato') {
    rect(r, x + 22, y + 20, 42, 34, '#df8d45'); rect(r, x + 31, y, 28, 28, '#efaa58'); rect(r, x + 29, y - 6, 10, 12, '#df8d45'); rect(r, x + 51, y - 6, 10, 12, '#df8d45');
    rect(r, x + 19, y + 50, 10, 18, '#df8d45'); rect(r, x + 54, y + 50, 10, 18, '#df8d45'); rect(r, x + 62, y + 28, 8, 8 + Math.abs(wave)*18, '#df8d45'); return;
  }
  if (id === 'borboleta') {
    const flap = moving ? 5 + Math.abs(wave)*14 : 12; rect(r, x + 46, y + 13, 7, 42, '#263d51'); rect(r, x + 18, y + flap, 28, 27, '#b76ee8'); rect(r, x + 53, y + flap, 28, 27, '#ef77a8'); rect(r, x + 26, y + flap + 8, 10, 10, '#ffd447'); rect(r, x + 63, y + flap + 8, 10, 10, '#ffd447'); return;
  }
  const pulse = moving ? 4 + Math.abs(wave) * 7 : 5; rect(r, x + 24, y + 8, 40, 40, '#ffd447'); rect(r, x + 33, y, 22, 56, '#ffd447'); rect(r, x + 16, y + 17, 56, 22, '#ffd447');
  rect(r, x + 38, y + 19, 5, 5, '#8f582b'); rect(r, x + 52, y + 19, 5, 5, '#8f582b'); rect(r, x + 40, y + 32, 15, 4, '#8f582b');
  if (moving) { rect(r, x + 41, y - pulse, 6, 8, '#ffd447'); rect(r, x + 41, y + 55, 6, 8, '#ffd447'); }
}

export function drawDiscoveries(renderer: CanvasRenderer, run: DiscoveryRun, reducedMotion: boolean, guideId?: string | null): void {
  for (const area of DISCOVERY_AREAS) {
    renderer.worldFillRect(area.x + 38, 320, 8, 144, '#986132');
    renderer.worldFillRect(area.x + 18, 270, 330, 42, area.color);
    renderer.worldText(area.label, area.x + 183, 291, { color: '#fff7df', font: 'bold 20px "Trebuchet MS", sans-serif' });
    for (let x = area.x + 70; x < area.x + 1550; x += 110) {
      renderer.worldFillRect(x, 450, 4, 14, '#397f4e');
      renderer.worldFillRect(x - 4, 445, 12, 7, area.color === '#986132' ? '#efaa58' : '#ef77a8');
    }
  }
  for (const item of run.objects) {
    const center = item.x + item.w / 2; const active = item.id === run.active?.id && run.animation > 0;
    renderer.worldFillRect(item.x, item.y + item.h - 8, item.w, 8, active ? '#ffd479' : run.discovered.has(item.id) ? '#55a866' : '#326855');
    drawObject(renderer, item.id, item.x + 4, item.y + 33, run.animation, active && !reducedMotion);
    const font = 'bold 20px "Trebuchet MS", sans-serif'; const width = renderer.measureText(item.label, font) + 20;
    renderer.worldFillRect(center - width / 2, item.y - 24, width, 30, '#fbf4df'); renderer.worldText(item.label, center, item.y - 9, { color: '#233d38', font });
    if (run.discovered.has(item.id)) renderer.worldText('✓', center + width / 2 + 12, item.y - 9, { color: '#326855', font: 'bold 22px sans-serif' });
    if (guideId === item.id) { renderer.worldText('▼', center, item.y - 54 + (reducedMotion ? 0 : Math.sin(run.animation * 5) * 5), { color: '#ffd447', font: 'bold 28px sans-serif' }); }
  }
}
