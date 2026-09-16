import { button, el } from '../dom.js';
import { POSE_FRAMES } from '../../render/atlas-meta.js';
import { formatTime } from '../../content/text-utils.js';

/** Which frame of the celebrate sheet reads best as a static victory pose. */
const VICTORY_FRAME_INDEX = 2;

/** One static frame cropped from the celebrate sprite sheet via CSS. */
function celebrateBadge(celebrateImage, name) {
  const { columns, rows } = POSE_FRAMES.celebrate;
  const column = VICTORY_FRAME_INDEX % columns;
  const row = Math.floor(VICTORY_FRAME_INDEX / columns);
  const posX = columns > 1 ? (column / (columns - 1)) * 100 : 0;
  const posY = rows > 1 ? (row / (rows - 1)) * 100 : 0;
  return el('div', {
    class: 'victory-celebrate',
    role: 'img',
    'aria-label': name,
    style: `background-image:url(${celebrateImage});background-size:${columns * 100}% ${rows * 100}%;background-position:${posX}% ${posY}%;`,
  });
}

/** @returns {{ node: HTMLElement, primary: () => void, back: () => void }} */
export function buildVictoryScreen({ lesson, character, stars, mistakes, hasNext, onNext, onReplay, onMenu }) {
  const starRow = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
  const celebrateImage = character?.sprites?.celebrate;
  const node = el('div', { class: 'overlay' }, [
    el('h1', { text: 'Muito bem!' }),
    celebrateImage ? celebrateBadge(celebrateImage, character.name) : null,
    el('h2', { text: `Você coletou ${lesson?.target ?? ''}` }),
    el('p', { text: `${starRow}   (${mistakes} erro${mistakes === 1 ? '' : 's'})` }),
    el('div', { class: 'overlay-actions' }, [
      hasNext ? button('Próxima fase', { primary: true, onClick: onNext }) : null,
      button('Jogar de novo', { onClick: onReplay }),
      button('Menu', { onClick: onMenu }),
    ]),
  ]);
  return { node, primary: hasNext ? onNext : onReplay, back: onMenu };
}

/** @returns {{ node: HTMLElement, primary: () => void, back: () => void }} */
export function buildSpeedrunVictoryScreen({
  character,
  elapsed = 0,
  mistakes = 0,
  isNewBest = false,
  bestTime = 0,
  totalLetters = 26,
  onReplay,
  onMenu,
}) {
  const timeStr = formatTime(elapsed);
  const bestStr = formatTime(bestTime);
  const celebrateImage = character?.sprites?.celebrate;

  const node = el('div', { class: 'overlay' }, [
    el('h1', { text: isNewBest ? '🏆 NOVO RECORDE!' : '🏁 Maratona concluída!' }),
    celebrateImage ? celebrateBadge(celebrateImage, character.name) : null,
    el('h2', { text: `Tempo da corrida: ⏱️ ${timeStr}` }),
    el('p', {
      text: isNewBest
        ? '⭐ Esse foi o seu melhor tempo pessoal!'
        : `Melhor tempo salvo: ${bestStr}`,
    }),
    el('p', {
      text: `Todas as ${totalLetters} letras coletadas com ${mistakes} erro${mistakes === 1 ? '' : 's'}!`,
    }),
    el('div', { class: 'overlay-actions' }, [
      button('Correr de novo ⚡', { primary: true, onClick: onReplay }),
      button('Menu principal', { onClick: onMenu }),
    ]),
  ]);
  return { node, primary: onReplay, back: onMenu };
}
