import { describe, expect, it } from 'vitest';
import { formatSupportReport } from './support-info.js';

const env = {
  version: '0.4.0', commit: 'abc1234', builtAt: '2026-09-28T00:00:00.000Z',
  displayMode: 'app instalado (PWA)', serviceWorker: 'controlando a página',
  viewport: { width: 844, height: 390 }, visualViewport: { width: 844, height: 390, scale: 1 },
  devicePixelRatio: 3, orientation: 'landscape-primary', coarsePointer: true, maxTouchPoints: 5,
  inputMode: 'ui', scene: 'menu', reducedMotion: false,
  touchLayout: { size: 'large', jumpSide: 'left', edgeInset: 'far' },
  language: 'pt-BR', userAgent: 'Mozilla/5.0 (iPhone)', frames: null,
};

describe('formatSupportReport (docs/18 §10)', () => {
  it('lists build, viewport, input and presets one per line', () => {
    const report = formatSupportReport(env);
    expect(report).toContain('0.4.0 (abc1234');
    expect(report).toContain('844×390');
    expect(report).toContain('zoom 1');
    expect(report).toContain('maior, pulo à esquerda, borda longe');
    expect(report).toContain('Quadros: medição desligada');
  });

  it('includes frame numbers only when measuring and never personal data', () => {
    const report = formatSupportReport({ ...env, frames: { frames: 120, averageMs: 16.71, p95Ms: 18.2, slowFrames: 2 } });
    expect(report).toContain('120 medidos');
    expect(report).toContain('2 lentos');
    expect(report).not.toMatch(/Nicolas Gomes|Eloá [A-Z]|progresso|estrelas/);
  });

  it('says when the visual viewport API is missing', () => {
    expect(formatSupportReport({ ...env, visualViewport: null })).toContain('indisponível');
  });
});
