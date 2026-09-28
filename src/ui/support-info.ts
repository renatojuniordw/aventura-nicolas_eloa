import type { FrameSummary } from './frame-stats.js';
import type { TouchLayout } from '../persistence/touch-layout-store.js';

/**
 * "Informações para suporte" (docs/18 §10): enough to compare two sessions
 * (build, viewport, input, presets, frame times) and nothing personal — no
 * child names, progress, audio or gesture history. Collected only when the
 * support screen is opened and copied only by an explicit tap; never sent.
 */
export interface SupportEnvironment {
  version: string;
  commit: string;
  builtAt: string;
  displayMode: 'app instalado (PWA)' | 'navegador';
  serviceWorker: 'controlando a página' | 'não ativo' | 'não suportado';
  viewport: { width: number; height: number };
  visualViewport: { width: number; height: number; scale: number } | null;
  devicePixelRatio: number;
  orientation: string;
  coarsePointer: boolean;
  maxTouchPoints: number;
  inputMode: string | null;
  scene: string | null;
  reducedMotion: boolean;
  touchLayout: TouchLayout;
  language: string;
  userAgent: string;
  frames: FrameSummary | null;
}

interface ReadOptions {
  reducedMotion: boolean;
  touchLayout: TouchLayout;
  frames: FrameSummary | null;
}

const buildValue = (read: () => string): string => {
  try {
    return read();
  } catch {
    return 'dev';
  }
};

/** Reads the live browser state; only called from the support screen. */
export function readSupportEnvironment({ reducedMotion, touchLayout, frames }: ReadOptions): SupportEnvironment {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
  const visual = window.visualViewport;
  return {
    version: buildValue(() => __APP_VERSION__),
    commit: buildValue(() => __APP_COMMIT__),
    builtAt: buildValue(() => __APP_BUILT_AT__),
    displayMode: standalone ? 'app instalado (PWA)' : 'navegador',
    serviceWorker: !('serviceWorker' in nav) ? 'não suportado' : nav.serviceWorker.controller ? 'controlando a página' : 'não ativo',
    viewport: { width: window.innerWidth, height: window.innerHeight },
    visualViewport: visual ? { width: visual.width, height: visual.height, scale: visual.scale } : null,
    devicePixelRatio: window.devicePixelRatio || 1,
    orientation: screen.orientation?.type ?? (window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait'),
    coarsePointer: Boolean(window.matchMedia?.('(pointer: coarse)').matches),
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    inputMode: document.body?.dataset.inputMode ?? null,
    scene: document.body?.dataset.scene ?? null,
    reducedMotion,
    touchLayout,
    language: nav.language,
    userAgent: nav.userAgent,
    frames,
  };
}

const LAYOUT_LABELS: Record<string, string> = {
  default: 'padrão', large: 'maior', right: 'pulo à direita', left: 'pulo à esquerda',
  near: 'borda perto', medium: 'borda média', far: 'borda longe',
};

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

/** Plain text, one fact per line, stable order — easy to diff between two sessions. */
export function formatSupportReport(env: SupportEnvironment): string {
  const { touchLayout: layout, frames, visualViewport: visual } = env;
  const lines = [
    `Aventura do Nicolas&Eloá ${env.version} (${env.commit}, build ${env.builtAt})`,
    `Modo: ${env.displayMode} · service worker ${env.serviceWorker}`,
    `Tela (CSS px): ${env.viewport.width}×${env.viewport.height} · ${env.orientation} · densidade ${round(env.devicePixelRatio, 2)}`,
    visual
      ? `Área visível: ${round(visual.width)}×${round(visual.height)} · zoom ${round(visual.scale, 2)}`
      : 'Área visível: indisponível neste navegador',
    `Toque: ${env.coarsePointer ? 'sim' : 'não'} (até ${env.maxTouchPoints} dedos) · modo de interação ${env.inputMode ?? '—'} · cena ${env.scene ?? '—'}`,
    `Controles: ${[layout.size, layout.jumpSide, layout.edgeInset].map((value) => LAYOUT_LABELS[value] ?? value).join(', ')}`,
    `Movimento reduzido: ${env.reducedMotion ? 'sim' : 'não'} · idioma ${env.language}`,
    frames
      ? `Quadros: ${frames.frames} medidos · média ${round(frames.averageMs)} ms · p95 ${round(frames.p95Ms)} ms · ${frames.slowFrames} lentos (>33 ms)`
      : 'Quadros: medição desligada',
    `Navegador: ${env.userAgent}`,
  ];
  return lines.join('\n');
}
