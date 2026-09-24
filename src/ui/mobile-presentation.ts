import { Events, type EventBus } from '../core/event-bus.js';

export function initMobilePresentation({ bus, isTouch, pause, resetInput, goToMenu }: {
  bus: EventBus; isTouch: boolean; pause: () => void; resetInput: () => void; goToMenu: () => void;
}): () => void {
  const portrait = window.matchMedia('(orientation: portrait)');
  let playing = false;
  const app = document.getElementById('app');
  const warning = document.querySelector<HTMLElement>('.orientation-warning');
  let blocked = false;
  const refresh = () => {
    const needsLandscape = isTouch && playing && portrait.matches;
    document.body.classList.toggle('needs-landscape', needsLandscape);
    if (app) app.inert = needsLandscape;
    if (needsLandscape && !blocked) {
      resetInput(); pause();
      warning?.querySelector<HTMLElement>('button')?.focus();
    }
    if (!needsLandscape && blocked) document.querySelector<HTMLElement>('#overlay-root button')?.focus();
    blocked = needsLandscape;
  };
  const off = bus.on(Events.SCENE_CHANGED, ({ name }) => {
    playing = name === 'game' || name === 'exploration';
    document.body.dataset.scene = name;
    if (!playing) {
      try { window.screen.orientation?.unlock?.(); } catch { /* unsupported */ }
    }
    refresh();
  });
  const back = document.getElementById('orientation-back');
  back?.addEventListener('click', goToMenu);
  portrait.addEventListener('change', refresh);
  return () => {
    off(); portrait.removeEventListener('change', refresh);
    back?.removeEventListener('click', goToMenu);
    if (app) app.inert = false;
    document.body.classList.remove('needs-landscape');
  };
}
