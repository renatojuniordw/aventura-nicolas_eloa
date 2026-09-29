import { useRef } from 'react';
import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { WordPicture } from './word-picture.js';
import { gridCapacity, PaginationControls, panelBox, useArea, useBoxSize, usePager } from './layout.js';
import type { WordEntry } from '../../content/word-bank.js';

export interface DiscoveryEntry {
  word: WordEntry;
  completed: boolean;
}

interface DiscoveriesOptions {
  playerName: string;
  words: DiscoveryEntry[];
  /** Opens one word's page: picture, sentence, Ouvir and Jogar de novo (docs/22 M06). */
  onOpenWord: (entry: DiscoveryEntry) => void;
  onExplore: () => void;
  onBack: () => void;
}

const stateText = (completed: boolean) => (completed ? 'Palavra montada' : 'Palavra visitada');

/** Catalog cell: picture beside the word, in rem (see `gridCapacity`). */
const CARD = { width: 12.5, height: 6, gap: 0.75 };
/** Heading, subtitle, pager and footer around the grid, in rem, before the first layout. */
const CHROME_REM = 13;

function DiscoveriesScreen({ playerName, words, onOpenWord, onExplore, onBack }: DiscoveriesOptions) {
  const area = useArea();
  const body = useRef<HTMLDivElement>(null);
  const box = useBoxSize(body, panelBox(area, CHROME_REM));
  const pager = usePager({
    id: 'discoveries',
    items: words,
    getId: (entry) => entry.word.id,
    capacity: gridCapacity(box, area.rem, CARD),
  });
  return (
    <div className="overlay screen screen-fill discoveries-screen">
      <header className="screen-head">
        <h1>Caderno de descobertas</h1>
        <p>As palavras de {playerName}</p>
      </header>
      <div className="screen-body" ref={body}>
        {words.length === 0 ? (
          <div className="discoveries-empty">
            <p>Seu caderno está esperando a primeira palavra!</p>
            <MenuButton className="primary" onClick={onExplore}>Explorar e descobrir</MenuButton>
          </div>
        ) : (
          <ul className="discoveries-grid">
            {pager.items.map((entry) => (
              <li key={entry.word.id}>
                {/* One button per word: the page with the sentence and actions is a tap away. */}
                <MenuButton
                  className="discovery-card"
                  data-nav-id={`word-${entry.word.id}`}
                  aria-label={`${entry.word.label}, ${stateText(entry.completed).toLowerCase()}. Abrir`}
                  onClick={() => onOpenWord(entry)}
                >
                  <WordPicture word={entry.word} />
                  <span className="discovery-card-text">
                    <strong>{entry.word.label}</strong>
                    <small>{entry.completed ? '✔ ' : ''}{stateText(entry.completed)}</small>
                  </span>
                </MenuButton>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="screen-nav">
        <PaginationControls pager={pager} label="Páginas do caderno" itemNoun="Palavra" />
        <div className="overlay-actions screen-foot">
          <MenuButton data-nav-id="back" onClick={onBack}>Voltar ao menu</MenuButton>
        </div>
      </div>
    </div>
  );
}

export function buildDiscoveriesScreen(options: DiscoveriesOptions) {
  const { words, onExplore, onBack } = options;
  return buildScreen(<DiscoveriesScreen {...options} />, { primary: words.length ? onBack : onExplore, back: onBack });
}

interface DiscoveryDetailOptions extends DiscoveryEntry {
  onListen: (word: WordEntry) => void;
  onReplay: (word: WordEntry) => void;
  /** Back to the catalog, on the page and card this word was opened from. */
  onBack: () => void;
}

/**
 * One word of the notebook. Picture beside the text in landscape, above it
 * in portrait; Ouvir starts focused. Separate from the catalog so the
 * catalog stays one line per word (docs/22 M06).
 */
export function buildDiscoveryDetailScreen({ word, completed, onListen, onReplay, onBack }: DiscoveryDetailOptions) {
  return buildScreen(
    <div className="overlay screen discovery-detail">
      <div className="discovery-detail-media">
        <WordPicture word={word} />
      </div>
      <div className="discovery-detail-text">
        <h1>{word.label}</h1>
        <p className="discovery-detail-state">{completed ? '✔ ' : ''}{stateText(completed)}</p>
        <p>{word.fact}</p>
        <div className="overlay-actions">
          <MenuButton className="primary" data-autofocus="" aria-label={`Ouvir ${word.label}`} onClick={() => onListen(word)}>
            <span aria-hidden="true">♫ </span>Ouvir
          </MenuButton>
          <MenuButton aria-label={`Jogar ${word.label} novamente`} onClick={() => onReplay(word)}>Jogar de novo</MenuButton>
          <MenuButton data-nav-id="back" onClick={onBack}>Voltar ao caderno</MenuButton>
        </div>
      </div>
    </div>,
    { back: onBack },
  );
}
