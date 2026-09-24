import { buildScreen } from './mount-screen.js';
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
    <div className="overlay">
      <h1>Muito bem!</h1>
      {celebrateImage && character ? <CelebrateBadge celebrateImage={celebrateImage} name={character.name} /> : null}
      <h2>Você coletou {lesson?.target ?? ''}</h2>
      <p>
        {starRow}   ({mistakes} erro{mistakes === 1 ? '' : 's'})
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
    </div>
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
    <div className="overlay">
      <h1>{isNewBest ? '🏆 NOVO RECORDE!' : '🏁 Maratona concluída!'}</h1>
      {celebrateImage && character ? <CelebrateBadge celebrateImage={celebrateImage} name={character.name} /> : null}
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
    </div>
  );
}

export function buildSpeedrunVictoryScreen(options: SpeedrunVictoryOptions) {
  return buildScreen(<SpeedrunVictoryScreenView {...options} />, { primary: options.onReplay, back: options.onMenu });
}

interface ExploreVictoryOptions {
  character?: Character | null;
  word: string;
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
  return (
    <div className="overlay">
      <h1>Muito bem!</h1>
      {celebrateImage && character ? <CelebrateBadge celebrateImage={celebrateImage} name={character.name} /> : null}
      <h2>Você montou {word}</h2>
      {fact ? <p>{fact}</p> : null}
      <p>
        {starRow}   ({mistakes} erro{mistakes === 1 ? '' : 's'})
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
    </div>
  );
}

export function buildExploreVictoryScreen(options: ExploreVictoryOptions) {
  return buildScreen(<ExploreVictoryScreenView {...options} />, {
    primary: options.hasNext ? options.onNext : options.onReplay,
    back: options.onMenu,
  });
}
