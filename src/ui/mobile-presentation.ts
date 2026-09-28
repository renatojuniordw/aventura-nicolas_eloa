import { Events, type EventBus } from '../core/event-bus.js';

/**
 * Page-level presentation for touch play: the landscape guard, `data-scene`,
 * and `data-input-mode`, which scopes the no-gesture policy (no pinch/double
 * tap zoom, no scroll) to the canvas and touch controls only while a match
 * accepts movement. Menus, pause and settings keep native scroll and zoom.
 * `isTouch` may be a function so a hybrid device switching pointers is re-read.
 */
export function initMobilePresentation({ bus, isTouch, pause, resetInput, goToMenu }: {
  bus: EventBus; isTouch: boolean | (() => boolean); pause: () => void; resetInput: () => void; goToMenu: () => void;
}): () => void {
  const touch = typeof isTouch === 'function' ? isTouch : () => isTouch;
  const portrait = window.matchMedia('(orientation: portrait)');
  let playing = false;
  const app = document.getElementById('app');
  const warning = document.querySelector<HTMLElement>('.orientation-warning');
  let blocked = false;
  const refresh = () => {
    const needsLandscape = touch() && playing && portrait.matches;
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
    playing = name === 'game';
    document.body.dataset.scene = name;
    if (!playing) {
      try { window.screen.orientation?.unlock?.(); } catch { /* unsupported */ }
    }
    refresh();
  });
  const offInput = bus.on(Events.INPUT_MODE_CHANGED, ({ playing: live }) => {
    document.body.dataset.inputMode = live ? 'playing' : 'ui';
  });
  const back = document.getElementById('orientation-back');
  back?.addEventListener('click', goToMenu);
  portrait.addEventListener('change', refresh);
  return () => {
    off(); offInput(); delete document.body.dataset.inputMode;
    portrait.removeEventListener('change', refresh);
    back?.removeEventListener('click', goToMenu);
    if (app) app.inert = false;
    document.body.classList.remove('needs-landscape');
  };
}
