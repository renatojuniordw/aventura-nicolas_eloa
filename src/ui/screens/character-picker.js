import { button, el } from '../dom.js';
import { CHARACTERS } from '../../content/characters.js';

/** @returns {{ node: HTMLElement, primary: () => void, back: () => void }} */
export function buildCharacterPickerScreen({ selectedId, onSelect, onConfirm, onBack }) {
  const cards = CHARACTERS.map((character) =>
    el(
      'button',
      {
        class: 'companion-card',
        type: 'button',
        tabindex: '-1',
        'aria-pressed': String(character.id === selectedId),
        onClick: () => onSelect(character.id),
      },
      [
        character.portrait
          ? el('img', {
              class: 'companion-avatar',
              src: character.portrait,
              alt: character.name,
            })
          : el('span', {
              class: 'companion-swatch',
              style: `background:${character.color}`,
            }),
        el('span', { class: 'companion-name', text: character.name }),
      ],
    ),
  );

  const node = el('div', { class: 'overlay' }, [
    el('h2', { text: 'Escolha seu personagem' }),
    el('div', { class: 'character-grid' }, cards),
    el('div', { class: 'overlay-actions' }, [
      button('Pronto', { primary: true, onClick: onConfirm }),
      button('Voltar', { onClick: onBack }),
    ]),
  ]);

  return { node, primary: onConfirm, back: onBack };
}
