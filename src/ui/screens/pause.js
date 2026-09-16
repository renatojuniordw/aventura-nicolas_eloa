import { button, el } from '../dom.js';

/**
 * The pause screen is a tiny state machine rendered into the same overlay
 * node: 'menu' (default) or a 'confirm-restart'/'confirm-menu' step that
 * guards the two destructive actions. There is no overlay-stacking mechanism
 * in `MenuOverlay`, so re-rendering in place is simpler than mounting a
 * second screen on top.
 *
 * @param {'menu'|'confirm-restart'|'confirm-menu'} step
 * @param {{ onResume, onRestart, onMenu, isSpeedrun?: boolean, isMuted?: boolean, onToggleMute }} options
 * @param {(nextStep: string) => void} goTo re-renders this screen at `nextStep`
 * @returns {{ node: HTMLElement, primary: () => void, back: () => void }}
 */
export function buildPauseScreen(
  step,
  { onResume, onRestart, onMenu, isSpeedrun = false, isMuted = false, onToggleMute },
  goTo,
) {
  if (step === 'menu') {
    const node = el('div', { class: 'overlay' }, [
      el('h2', { text: 'Pausa' }),
      el('p', { text: 'Respire fundo e continue quando quiser.' }),
      el('div', { class: 'overlay-actions' }, [
        button('Continuar', { primary: true, onClick: onResume }),
        button('Recomeçar fase', { onClick: () => goTo('confirm-restart') }),
        button('Menu', { onClick: () => goTo('confirm-menu') }),
        button(isMuted ? '🔇 Som: Mudo' : '🔈 Som: Ligado', { onClick: onToggleMute }),
      ]),
    ]);
    return { node, primary: onResume, back: onResume };
  }

  const isRestart = step === 'confirm-restart';
  const confirmAction = isRestart ? onRestart : onMenu;
  const message = isRestart
    ? isSpeedrun
      ? 'Você vai perder o tempo desta corrida e recomeçar do zero.'
      : 'Você vai perder o progresso desta fase.'
    : 'Você vai voltar para o menu e perder o progresso desta fase.';

  const node = el('div', { class: 'overlay' }, [
    el('h2', { text: 'Tem certeza?' }),
    el('p', { text: message }),
    el('div', { class: 'overlay-actions' }, [
      button('Sim, confirmar', { primary: true, onClick: confirmAction }),
      button('Cancelar', { onClick: () => goTo('menu') }),
    ]),
  ]);
  return { node, primary: confirmAction, back: () => goTo('menu') };
}
