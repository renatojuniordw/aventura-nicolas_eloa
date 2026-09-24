import { useEffect, useRef } from 'react';
import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { CHARACTERS } from '../../content/characters.js';
import { formatTime } from '../../content/text-utils.js';
import { createCelebrationCanvas } from './celebration-canvas.js';
import type { Profile } from '../../persistence/migration.js';
import { useFullscreen } from '../hooks.js';

/**
 * Wraps the framework-agnostic celebration canvas (its own rAF loop, unit
 * tested directly in `celebration-canvas.test.js`/`.dom.test.js`) in a React
 * lifecycle: mount appends the canvas, unmount stops the animation loop —
 * `createCelebrationCanvas` itself stays untouched.
 */
function CelebrationCanvas({ imageSrc }: { imageSrc: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { canvas, stop } = createCelebrationCanvas(imageSrc, 120, 120);
    if (canvas && ref.current) ref.current.appendChild(canvas);
    return () => stop();
  }, [imageSrc]);

  return <div ref={ref} className="hero-animation-stage-canvas-host" />;
}

interface MainMenuOptions {
  profiles?: Profile[];
  activeProfileId?: string | null;
  selectedCharacterId?: string | null;
  completedCount?: number;
  totalLessons?: number;
  currentLessonTitle?: string;
  speedrunBestTime?: number | null;
  onPlay: () => void;
  onExplore?: () => void;
  onSpeedrun: () => void;
  onSelectProfile?: (profileId: string) => void;
  onSelectCharacter?: (characterId: string) => void;
  onOpenCharacterPicker?: (characterId: string) => void;
  onOpenLessonPicker: () => void;
  onOpenSettings: () => void;
}

/** Home Screen (Aventura do Nicolas&Eloá): clean, focused layout with dedicated character showcase. */
function MainMenuScreen({
  profiles = [],
  activeProfileId = null,
  selectedCharacterId = null,
  completedCount = 0,
  totalLessons = 0,
  currentLessonTitle = 'Família B',
  speedrunBestTime = null,
  onPlay,
  onExplore,
  onSpeedrun,
  onOpenCharacterPicker,
  onOpenLessonPicker,
  onOpenSettings,
}: MainMenuOptions) {
  const active = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? null;
  const currentCharacterId = selectedCharacterId || active?.characterId || CHARACTERS[0].id;
  const selectedChar = CHARACTERS.find((c) => c.id === currentCharacterId) ?? CHARACTERS[0];

  const bestTimeStr = speedrunBestTime != null ? formatTime(speedrunBestTime) : null;
  const speedrunText = bestTimeStr ? `⚡ Corrida do alfabeto (${bestTimeStr})` : '⚡ Corrida do alfabeto';

  const { supported, fullscreen, toggle: toggleFullscreen } = useFullscreen();

  return (
    <div className="overlay home-screen">
      {supported && (
        <MenuButton
          className="home-fullscreen-btn"

          aria-label={fullscreen ? 'Sair da tela cheia' : 'Modo tela cheia'}
          title={fullscreen ? 'Sair da tela cheia' : 'Modo tela cheia'}
          onClick={toggleFullscreen}
        >
          {fullscreen ? '🗗' : '⛶'}
        </MenuButton>
      )}
      <h1 className="sr-only">Aventura do Nicolas&amp;Eloá</h1>
      <div className="home-board">
        {/* Main Stage */}
        <div className="home-main-stage">
          {/* Left Wing: Hero Showcase Panel */}
          <div className="hero-showcase-panel">
            <div className="hero-showcase-badge">JOGADOR PRONTO</div>
            <div className="hero-visual-stage">
              {selectedChar?.portrait ? (
                <MenuButton

                  className="hero-portrait-frame hero-portrait-btn"
                  title="Clique para escolher ou trocar de personagem"
                  aria-label={`Trocar personagem. Atual: ${selectedChar.name}`}
                  onClick={() => onOpenCharacterPicker?.(currentCharacterId)}
                >
                  <img
                    className="hero-large-portrait companion-avatar"
                    src={selectedChar.portrait}
                    alt={selectedChar.name}
                  />
                  <span className="hero-portrait-hint">Trocar 🔄</span>
                </MenuButton>
              ) : null}
              {selectedChar?.sprites?.celebrate ? (
                <div className="hero-animation-stage">
                  <CelebrationCanvas imageSrc={selectedChar.sprites.celebrate} />
                  <div className="hero-podium-pedestal" />
                </div>
              ) : null}
            </div>
            <div className="hero-showcase-footer">
              <div className="hero-name-plate">⭐ {selectedChar?.name ?? 'Nicolas Gomes'}</div>
              <div className="hero-flavor-text">Pronto para pular, descobrir e brincar!</div>
              {onOpenCharacterPicker && (
                <MenuButton

                  className="hero-change-btn"
                  onClick={() => onOpenCharacterPicker(currentCharacterId)}
                >
                  🔄 Trocar Personagem
                </MenuButton>
              )}
            </div>
          </div>

          {/* Right Wing: Action Menu Panel */}
          <div className="home-menu-panel">
            <div className="discovery-plaque">
              <div className="discovery-title">SUA PRÓXIMA DESCOBERTA</div>
              <div className="discovery-target">{currentLessonTitle}</div>
            </div>
            <div className="menu-buttons-group home-btn-group">
              {onExplore && <MenuButton className="btn-retro btn-explore" onClick={onExplore}>
                <strong>Explorar o quintal</strong><small>Descubra no seu ritmo, sem regras de ordem</small>
              </MenuButton>}
              <MenuButton
                className="btn-retro btn-primary-gold"

                onClick={onPlay}
              >
                {active && completedCount > 0 ? 'Continuar aventura' : 'Começar aventura'}
              </MenuButton>
              <MenuButton
                className="btn-retro btn-secondary-green"

                onClick={onSpeedrun}
              >
                {speedrunText}
              </MenuButton>
              <MenuButton
                className="btn-retro btn-secondary-green"

                onClick={onOpenLessonPicker}
              >
                Escolher fase
              </MenuButton>
              <div className="menu-meta-row home-meta-row">
                <MenuButton className="btn-util" onClick={onOpenSettings}>
                  ⚙️ Configurações
                </MenuButton>
                <div className="home-substatus">
                  A aventura continua · {completedCount} de {totalLessons} fases
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- 4. Footer Tips --- */}
      <div className="home-footer-tips">
        <span className="footer-tip-keyboard">Tab para escolher · Enter para brincar</span>
        <span className="footer-tip-touch">Toque para escolher · Toque para brincar</span>
      </div>
    </div>
  );
}

export function buildMainMenuScreen(options: MainMenuOptions) {
  return buildScreen(<MainMenuScreen {...options} />, { primary: options.onPlay });
}
