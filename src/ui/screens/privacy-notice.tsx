import { el } from '../dom.js';

/**
 * Parental notice shown once on first run, before any profile is created.
 * Explains in plain language that the child's name and progress stay on the
 * device and are never sent anywhere. The game only proceeds after the
 * responsible adult confirms.
 *
 * @param {{ onConfirm: () => void }} options
 * @returns {{ node: HTMLElement, primary: () => void, back: null }}
 */
export function buildPrivacyNoticeScreen({ onConfirm }) {
  const node = el('div', { class: 'overlay privacy-notice' }, [
    el('h2', { text: 'Um recado para os responsáveis' }),
    el('p', {
      text: 'O nome da criança e o progresso do jogo ficam guardados só neste aparelho. Nada é enviado para a internet nem compartilhado com ninguém.',
    }),
    el('p', {
      text: 'A opção "Zerar progresso" no menu apaga as fases concluídas. Para remover também o nome da criança, limpe os dados do site no navegador.',
    }),
    el('div', { class: 'overlay-actions' }, [
      el('button', {
        class: 'btn-retro btn-primary-gold',
        type: 'button',
        tabindex: '-1',
        text: 'Entendi, pode começar',
        onClick: onConfirm,
      }),
    ]),
  ]);

  return { node, primary: onConfirm, back: null };
}
