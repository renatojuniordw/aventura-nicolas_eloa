import { useEffect, useRef, useState } from 'react';
import { mountScreen, blurOnClick } from './mount-screen.js';
import { CHARACTERS } from '../../content/characters.js';
import { formatTime } from '../../content/text-utils.js';
import { createCelebrationCanvas } from './celebration-canvas.js';
import type { Profile } from '../../persistence/migration.js';
import { isFullscreenSupported, isFullscreen, toggleFullscreen, onFullscreenChange } from '../fullscreen.js';

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
  onSpeedrun,
  onOpenCharacterPicker,
  onOpenLessonPicker,
  onOpenSettings,
}: MainMenuOptions) {
  const active = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? null;
  const currentCharacterId = selectedCharacterId || active?.characterId || CHARACTERS[0].id;
  const selectedChar = CHARACTERS.find((c) => c.id === currentCharacterId) ?? CHARACTERS[0];

  const bestTimeStr = speedrunBestTime != null ? formatTime(speedrunBestTime) : null;
  const speedrunText = bestTimeStr ? `⚡ Speed Run (${bestTimeStr})` : '⚡ Speed Run (A ao Z)';

  const [fullscreen, setFullscreen] = useState(() => isFullscreen());
  const supported = isFullscreenSupported();

  useEffect(() => {
    return onFullscreenChange((active) => setFullscreen(active));
  }, []);

  return (
    <div className="overlay home-screen">
      {supported && (
        <button
          className="home-fullscreen-btn"
          type="button"
          tabIndex={-1}
          aria-label={fullscreen ? 'Sair da tela cheia' : 'Modo tela cheia'}
          title={fullscreen ? 'Sair da tela cheia' : 'Modo tela cheia'}
          onClick={blurOnClick(async () => {
            const active = await toggleFullscreen();
            setFullscreen(active);
          })}
        >
          {fullscreen ? '🗗' : '⛶'}
        </button>
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
                <button
                  type="button"
                  tabIndex={-1}
                  className="hero-portrait-frame hero-portrait-btn"
                  title="Clique para escolher ou trocar de personagem"
                  aria-label={`Trocar personagem. Atual: ${selectedChar.name}`}
                  onClick={blurOnClick(() => onOpenCharacterPicker?.(currentCharacterId))}
                >
                  <img
                    className="hero-large-portrait companion-avatar"
                    src={selectedChar.portrait}
                    alt={selectedChar.name}
                  />
                  <span className="hero-portrait-hint">Trocar 🔄</span>
                </button>
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
                <button
                  type="button"
                  tabIndex={-1}
                  className="hero-change-btn"
                  onClick={blurOnClick(() => onOpenCharacterPicker(currentCharacterId))}
                >
                  🔄 Trocar Personagem
                </button>
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
              <button
                className="btn-retro btn-primary-gold"
                type="button"
                tabIndex={-1}
                onClick={blurOnClick(onPlay)}
              >
                {active && completedCount > 0 ? 'Continuar aventura' : 'Começar aventura'}
              </button>
              <button
                className="btn-retro btn-secondary-green"
                type="button"
                tabIndex={-1}
                onClick={blurOnClick(onSpeedrun)}
              >
                {speedrunText}
              </button>
              <button
                className="btn-retro btn-secondary-green"
                type="button"
                tabIndex={-1}
                onClick={blurOnClick(onOpenLessonPicker)}
              >
                Escolher fase
              </button>
              <div className="menu-meta-row home-meta-row">
                <button className="btn-util" type="button" tabIndex={-1} onClick={blurOnClick(onOpenSettings)}>
                  ⚙️ Configurações
                </button>
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
        <span className="footer-tip-keyboard">Setas ou controle para escolher · Enter para brincar</span>
        <span className="footer-tip-touch">Toque para escolher · Toque para brincar</span>
      </div>
    </div>
  );
}

export function buildMainMenuScreen(options: MainMenuOptions) {
  const { node, cleanup } = mountScreen(<MainMenuScreen {...options} />);
  return {
    node,
    primary: options.onPlay,
    back: null,
    cleanup,
  };
}
