import { JOURNEY_LENGTH } from '../../content/discoveries.js';
import { useEffect, useRef } from 'react';
import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { CHARACTERS } from '../../content/characters.js';
import { formatTime } from '../../content/text-utils.js';
import { createCelebrationCanvas } from './celebration-canvas.js';
import type { Profile } from '../../persistence/migration.js';
import { useFullscreen } from '../hooks.js';
import type { MotionPolicy } from '../motion-policy.js';

/**
 * Wraps the framework-agnostic celebration canvas (its own rAF loop, unit
 * tested directly in `celebration-canvas.test.js`/`.dom.test.js`) in a React
 * lifecycle: mount appends the canvas, a motion-policy change refreshes it,
 * unmount stops the loop and its listeners. When the stage is hidden by CSS
 * the helper itself stays idle (IntersectionObserver), see docs/18 §3.
 */
function CelebrationCanvas({ imageSrc, motion }: { imageSrc: string; motion?: MotionPolicy }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    const { canvas, stop, refresh } = createCelebrationCanvas(imageSrc, 120, 120, { reducedMotion: motion?.reduced });
    if (canvas && host) host.appendChild(canvas);
    const unsubscribe = motion?.subscribe(() => refresh());
    return () => {
      unsubscribe?.();
      stop();
      canvas?.remove();
    };
  }, [imageSrc, motion]);

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
  onOpenDiscoveries?: () => void;
  onSpeedrun: () => void;
  onSelectProfile?: (profileId: string) => void;
  onSelectCharacter?: (characterId: string) => void;
  onOpenCharacterPicker?: (characterId: string) => void;
  onOpenSettings: () => void;
  /** Effective reduced-motion rule; without it the celebration follows only the system. */
  motion?: MotionPolicy;
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
  onOpenDiscoveries,
  onSpeedrun,
  onOpenCharacterPicker,
  onOpenSettings,
  motion,
}: MainMenuOptions) {
  const active = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? null;
  const currentCharacterId = selectedCharacterId || active?.characterId || CHARACTERS[0].id;
  const selectedChar = CHARACTERS.find((c) => c.id === currentCharacterId) ?? CHARACTERS[0];

  const bestTimeStr = speedrunBestTime != null ? formatTime(speedrunBestTime) : null;
  const speedrunText = bestTimeStr ? `⚡ Corrida do alfabeto (${bestTimeStr})` : '⚡ Corrida do alfabeto';

  const { supported, fullscreen, toggle: toggleFullscreen } = useFullscreen();

  return (
    <div className={supported ? 'overlay home-screen has-fullscreen' : 'overlay home-screen'}>
      {supported && (
        <MenuButton
          className="home-fullscreen-btn"
          data-nav-id="fullscreen"

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
                // The single "change character" action: portrait plus its visible label.
                <MenuButton
                  className="hero-portrait-frame hero-portrait-btn"
                  data-nav-id="character"
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
                  <CelebrationCanvas imageSrc={selectedChar.sprites.celebrate} motion={motion} />
                  <div className="hero-podium-pedestal" />
                </div>
              ) : null}
            </div>
            <div className="hero-showcase-footer">
              <div className="hero-name-plate">⭐ {selectedChar?.name ?? 'Nicolas Gomes'}</div>
              <div className="hero-flavor-text">Pronto para pular, descobrir e brincar!</div>
              {/* Fallback only when there is no portrait to tap. */}
              {onOpenCharacterPicker && !selectedChar?.portrait && (
                <MenuButton
                  className="hero-change-btn"
                  data-nav-id="character"
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
            {/* DOM order = visual order = focus order (the compact grid pairs them two by two). */}
            <div className="menu-buttons-group home-btn-group">
              <MenuButton className="btn-retro btn-primary-gold" data-autofocus="" data-nav-id="play" onClick={onPlay}>
                {active && completedCount > 0 ? 'Continuar aventura' : 'Começar aventura'}
              </MenuButton>
              {onExplore && <MenuButton className="btn-retro btn-explore" onClick={onExplore}>
                <strong>Explorar</strong><small className="btn-explore-detail">Jornadas de até {JOURNEY_LENGTH} palavras</small>
              </MenuButton>}
              <MenuButton className="btn-retro btn-secondary-green" onClick={onSpeedrun}>
                {speedrunText}
              </MenuButton>
              {onOpenDiscoveries && <MenuButton className="btn-util" onClick={onOpenDiscoveries}>Caderno de descobertas</MenuButton>}
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
