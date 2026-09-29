import { JOURNEY_LENGTH } from '../../content/discoveries.js';
import { WordPicture } from './word-picture.js';
import type { WordEntry } from '../../content/word-bank.js';
import type { ReactNode } from 'react';
import { buildScreen } from './mount-screen.js';
import { fitCount, PaginationControls, useArea, usePager } from './layout.js';
import { MenuButton } from './menu-button.js';
import { POSE_FRAMES } from '../../content/atlas-meta.js';
import { formatTime } from '../../content/text-utils.js';
import type { Character } from '../../content/characters.js';

/** Which frame of the celebrate sheet reads best as a static victory pose. */
const VICTORY_FRAME_INDEX = 2;

/** One static frame cropped from the celebrate sprite sheet via CSS. */
function CelebrateBadge({ celebrateImage, name }: { celebrateImage: string; name: string }) {
  const { columns, rows } = POSE_FRAMES.celebrate;
  const column = VICTORY_FRAME_INDEX % columns;
  const row = Math.floor(VICTORY_FRAME_INDEX / columns);
  const posX = columns > 1 ? (column / (columns - 1)) * 100 : 0;
  const posY = rows > 1 ? (row / (rows - 1)) * 100 : 0;
  return (
    <div
      className="victory-celebrate"
      role="img"
      aria-label={name}
      style={{
        backgroundImage: `url(${celebrateImage})`,
        backgroundSize: `${columns * 100}% ${rows * 100}%`,
        backgroundPosition: `${posX}% ${posY}%`,
      }}
    />
  );
}

/**
 * Results share one composition (docs/22 M09): the picture beside the text
 * and actions when the screen is low and wide, above them otherwise. The
 * actions always stay inside the panel.
 */
function ResultLayout({ media, children }: { media: ReactNode; children: ReactNode }) {
  return (
    <div className={`overlay screen result-screen${media ? ' has-media' : ''}`}>
      {media ? <div className="result-media">{media}</div> : null}
      <div className="result-text">{children}</div>
    </div>
  );
}

interface VictoryOptions {
  lesson?: { target?: string } | null;
  character?: Character | null;
  stars: number;
  mistakes: number;
  hasNext: boolean;
  onNext: () => void;
  onReplay: () => void;
  onMenu: () => void;
}

function VictoryScreenView({ lesson, character, stars, mistakes, hasNext, onNext, onReplay, onMenu }: VictoryOptions) {
  const starRow = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
  const celebrateImage = character?.sprites?.celebrate;
  return (
    <ResultLayout media={celebrateImage && character ? <CelebrateBadge celebrateImage={celebrateImage} name={character.name} /> : null}>
      <h1>Muito bem!</h1>
      <h2>Você coletou {lesson?.target ?? ''}</h2>
      <p>
        <span aria-hidden="true">{starRow}</span><span className="sr-only">{stars} de 3 estrelas</span> ({mistakes} erro{mistakes === 1 ? '' : 's'})
      </p>
      <div className="overlay-actions">
        {hasNext ? (
          <MenuButton className="primary" onClick={onNext}>
            Próxima fase
          </MenuButton>
        ) : null}
        <MenuButton onClick={onReplay}>
          Jogar de novo
        </MenuButton>
        <MenuButton onClick={onMenu}>
          Menu
        </MenuButton>
      </div>
    </ResultLayout>
  );
}

export function buildVictoryScreen(options: VictoryOptions) {
  return buildScreen(<VictoryScreenView {...options} />, {
    primary: options.hasNext ? options.onNext : options.onReplay,
    back: options.onMenu,
  });
}

interface SpeedrunVictoryOptions {
  character?: Character | null;
  elapsed?: number;
  mistakes?: number;
  isNewBest?: boolean;
  bestTime?: number;
  totalLetters?: number;
  onReplay: () => void;
  onMenu: () => void;
}

function SpeedrunVictoryScreenView({
  character,
  elapsed = 0,
  mistakes = 0,
  isNewBest = false,
  bestTime = 0,
  totalLetters = 26,
  onReplay,
  onMenu,
}: SpeedrunVictoryOptions) {
  const timeStr = formatTime(elapsed);
  const bestStr = formatTime(bestTime);
  const celebrateImage = character?.sprites?.celebrate;

  return (
    <ResultLayout media={celebrateImage && character ? <CelebrateBadge celebrateImage={celebrateImage} name={character.name} /> : null}>
      <h1>{isNewBest ? '🏆 NOVO RECORDE!' : '🏁 Maratona concluída!'}</h1>
      <h2>Tempo da corrida: ⏱️ {timeStr}</h2>
      <p>{isNewBest ? '⭐ Esse foi o seu melhor tempo pessoal!' : `Melhor tempo salvo: ${bestStr}`}</p>
      <p>
        Todas as {totalLetters} letras coletadas com {mistakes} erro{mistakes === 1 ? '' : 's'}!
      </p>
      <div className="overlay-actions">
        <MenuButton className="primary" onClick={onReplay}>
          Correr de novo ⚡
        </MenuButton>
        <MenuButton onClick={onMenu}>
          Menu principal
        </MenuButton>
      </div>
    </ResultLayout>
  );
}

export function buildSpeedrunVictoryScreen(options: SpeedrunVictoryOptions) {
  return buildScreen(<SpeedrunVictoryScreenView {...options} />, { primary: options.onReplay, back: options.onMenu });
}

interface ExploreVictoryOptions {
  character?: Character | null;
  word: string;
  illustration?: WordEntry;
  journeyWords?: WordEntry[];
  journeyComplete?: boolean;
  fact?: string;
  stars: number;
  mistakes: number;
  hasNext: boolean;
  onNext: () => void;
  onReplay: () => void;
  onMenu: () => void;
}

function ExploreVictoryScreenView({
  character,
  word,
  illustration,
  journeyWords = [],
  journeyComplete = false,
  fact = '',
  stars,
  mistakes,
  hasNext,
  onNext,
  onReplay,
  onMenu,
}: ExploreVictoryOptions) {
  const starRow = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
  const celebrateImage = character?.sprites?.celebrate;
  const area = useArea();
  // The summary's words sit in one row; a short screen pages them rather than piling them up.
  const pager = usePager({
    id: 'journey-words',
    items: journeyWords,
    getId: (entry) => entry.id,
    capacity: area.height < 22 * area.rem ? fitCount(area.width - 20 * area.rem, 6.5 * area.rem, area.rem) : fitCount(area.width - 3 * area.rem, 6.5 * area.rem, area.rem),
  });
  const media = journeyComplete ? null : illustration
    ? <WordPicture word={illustration} />
    : celebrateImage && character ? <CelebrateBadge celebrateImage={celebrateImage} name={character.name} /> : null;
  return (
    <ResultLayout media={media}>
      <h1>{journeyComplete ? 'Jornada concluída!' : 'Muito bem!'}</h1>
      {!journeyComplete && <h2>Você montou {word}</h2>}
      {journeyComplete ? <section className="journey-summary" aria-label="Resumo da jornada">
        <p>Nesta jornada você montou:</p>
        <ul className="journey-words">{pager.items.map(entry => <li key={entry.id}><WordPicture word={entry} /><strong>{entry.label}</strong></li>)}</ul>
        <PaginationControls pager={pager} label="Palavras da jornada" itemNoun="Palavra" />
        <p>Seu progresso está salvo. Você pode descansar e voltar depois!</p>
      </section> : <p>{journeyWords.length} de {JOURNEY_LENGTH} palavras da jornada concluídas</p>}
      {!journeyComplete && fact ? <p>{fact}</p> : null}
      {!journeyComplete && <p><span aria-hidden="true">{starRow}</span><span className="sr-only">{stars} de 3 estrelas</span> ({mistakes} erro{mistakes === 1 ? '' : 's'})</p>}
      <div className="overlay-actions">
        {journeyComplete && <MenuButton className="primary" onClick={onMenu}>Concluir e voltar ao menu</MenuButton>}
        {hasNext ? (
          <MenuButton className={journeyComplete ? undefined : "primary"} onClick={onNext}>
            {journeyComplete ? 'Começar outra jornada' : 'Próxima palavra'}
          </MenuButton>
        ) : null}
        <MenuButton onClick={onReplay}>
          {journeyComplete ? 'Repetir última palavra' : 'Jogar de novo'}
        </MenuButton>
        {!journeyComplete && <MenuButton onClick={onMenu}>Menu</MenuButton>}
      </div>
    </ResultLayout>
  );
}

export function buildExploreVictoryScreen(options: ExploreVictoryOptions) {
  return buildScreen(<ExploreVictoryScreenView {...options} />, {
    primary: options.journeyComplete ? options.onMenu : options.hasNext ? options.onNext : options.onReplay,
    back: options.onMenu,
  });
}
