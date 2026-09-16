import { mountScreen, blurOnClick } from './mount-screen.js';

interface GameOverOptions {
  lesson?: { objective?: string } | null;
  onRetry: () => void;
  onMenu: () => void;
}

function GameOverScreen({ lesson, onRetry, onMenu }: GameOverOptions) {
  return (
    <div className="overlay">
      <h2>Acabaram os corações</h2>
      <p>Vamos tentar de novo: {lesson?.objective ?? ''}</p>
      <div className="overlay-actions">
        <button type="button" tabIndex={-1} className="primary" onClick={blurOnClick(onRetry)}>
          Tentar de novo
        </button>
        <button type="button" tabIndex={-1} onClick={blurOnClick(onMenu)}>
          Menu
        </button>
      </div>
    </div>
  );
}

export function buildGameOverScreen(options: GameOverOptions) {
  const { node, cleanup } = mountScreen(<GameOverScreen {...options} />);
  return { node, primary: options.onRetry, back: options.onMenu, cleanup };
}
