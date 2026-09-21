import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';

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
        <MenuButton className="primary" onClick={onRetry}>
          Tentar de novo
        </MenuButton>
        <MenuButton onClick={onMenu}>
          Menu
        </MenuButton>
      </div>
    </div>
  );
}

export function buildGameOverScreen(options: GameOverOptions) {
  return buildScreen(<GameOverScreen {...options} />, { primary: options.onRetry, back: options.onMenu });
}
