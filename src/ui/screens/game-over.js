import { button, el } from '../dom.js';

/** @returns {{ node: HTMLElement, primary: () => void, back: () => void }} */
export function buildGameOverScreen({ lesson, onRetry, onMenu }) {
  const node = el('div', { class: 'overlay' }, [
    el('h2', { text: 'Acabaram os corações' }),
    el('p', { text: `Vamos tentar de novo: ${lesson?.objective ?? ''}` }),
    el('div', { class: 'overlay-actions' }, [
      button('Tentar de novo', { primary: true, onClick: onRetry }),
      button('Menu', { onClick: onMenu }),
    ]),
  ]);
  return { node, primary: onRetry, back: onMenu };
}
