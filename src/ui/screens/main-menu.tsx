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
  /** "Escolher aventura" (docs/20 §4 L1): the next-discovery plaque opens the world map. */
  onOpenWorldMap?: () => void;
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
  onOpenWorldMap,
  onSpeedrun,
  onOpenCharacterPicker,
  onOpenSettings,
  motion,
}: MainMenuOptions) {
  const active = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? null;
  const currentCharacterId = selectedCharacterId || active?.characterId || CHARACTERS[0].id;
  const selectedChar = CHARACTERS.find((c) => c.id === currentCharacterId) ?? CHARACTERS[0];

  const bestTimeStr = speedrunBestTime != null ? formatTime(speedrunBestTime) : null;

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
          <span aria-hidden="true">{fullscreen ? '🗗' : '⛶'}</span>
        </MenuButton>
      )}
      <h1 className="sr-only">Aventura do Nicolas&amp;Eloá</h1>
      {/*
        Centred as one block in the usable area (docs/22 §5): current player,
        then next discovery, start/continue and the two pairs. DOM order =
        visual order = focus order.
      */}
      <div className="home-board">
        <div className="home-main-stage">
          <div className="hero-showcase-panel">
            <div className="hero-showcase-badge" aria-hidden="true">JOGADOR PRONTO</div>
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
                  <span className="hero-portrait-hint" aria-hidden="true">Trocar 🔄</span>
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
              <div className="hero-name-plate"><span aria-hidden="true">⭐ </span>{selectedChar?.name ?? 'Nicolas Gomes'}</div>
              <div className="home-substatus">{completedCount} de {totalLessons} fases</div>
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

          <div className="home-menu-panel">
            {/* The plaque doubles as the map entry, so the home gains no extra button. */}
            {onOpenWorldMap ? (
              <MenuButton
                className="discovery-plaque discovery-plaque-btn"
                data-nav-id="world-map"
                aria-label={`Escolher aventura. Sua próxima descoberta: ${currentLessonTitle}`}
                onClick={onOpenWorldMap}
              >
                <span className="discovery-title">Próxima descoberta</span>
                <span className="discovery-target">{currentLessonTitle}</span>
                <span className="discovery-plaque-action"><span aria-hidden="true">🗺️ </span>Escolher aventura</span>
              </MenuButton>
            ) : (
              <div className="discovery-plaque">
                <div className="discovery-title">Próxima descoberta</div>
                <div className="discovery-target">{currentLessonTitle}</div>
              </div>
            )}
            <div className="menu-buttons-group home-btn-group">
              <MenuButton className="btn-retro btn-primary-gold" data-autofocus="" data-nav-id="play" onClick={onPlay}>
                {active && completedCount > 0 ? 'Continuar aventura' : 'Começar aventura'}
              </MenuButton>
              {/* Pairs sit side by side whenever both labels fit (decided by the panel's width, not the orientation). */}
              <div className="home-pair">
                {onExplore && <MenuButton className="btn-retro btn-explore" onClick={onExplore}>
                  <strong>Explorar</strong><small className="btn-explore-detail">Jornadas de até {JOURNEY_LENGTH} palavras</small>
                </MenuButton>}
                <MenuButton className="btn-retro btn-secondary-green btn-speedrun" onClick={onSpeedrun}>
                  <strong><span aria-hidden="true">⚡ </span>Corrida do alfabeto</strong>
                  {bestTimeStr && <small className="btn-speedrun-detail">Recorde {bestTimeStr}</small>}
                </MenuButton>
              </div>
              <div className="home-pair">
                {onOpenDiscoveries && <MenuButton className="btn-util" onClick={onOpenDiscoveries}>Caderno de descobertas</MenuButton>}
                {/* Soft hyphen: on the narrowest phones the word breaks at a syllable, never at a random letter. */}
                <MenuButton className="btn-util" aria-label="Configurações" onClick={onOpenSettings}>
                  <span aria-hidden="true">⚙️ </span>Configu{'\u00AD'}rações
                </MenuButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="home-footer-tips" aria-hidden="true">
        <span className="footer-tip-keyboard">Tab para escolher · Enter para brincar</span>
      </div>
    </div>
  );
}

export function buildMainMenuScreen(options: MainMenuOptions) {
  return buildScreen(<MainMenuScreen {...options} />, { primary: options.onPlay });
}
