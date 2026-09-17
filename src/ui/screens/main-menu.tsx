import { useEffect, useRef } from 'react';
import { mountScreen, blurOnClick } from './mount-screen.js';
import { CHARACTERS, type Character } from '../../content/characters.js';
import { createPixelLogoSvg } from '../pixel-logo.js';
import { formatTime } from '../../content/text-utils.js';
import { createCelebrationCanvas } from './celebration-canvas.js';
import type { Profile } from '../../persistence/migration.js';

/** Wraps the framework-agnostic SVG builder in a React lifecycle. */
function PixelLogo() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const svg = createPixelLogoSvg();
    if (svg && ref.current) ref.current.appendChild(svg);
  }, []);

  return (
    <div className="pixel-logo-wrapper" ref={ref}>
      <h1 className="sr-only">Aventura do Nicolas&amp;Eloá</h1>
    </div>
  );
}

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
  onOpenPhonePairing: () => void;
  onResetProgress: () => void;
}

function SelectorCard({ character, isSelected, onSelectCharacter }: { character: Character; isSelected: boolean; onSelectCharacter?: (id: string) => void }) {
  return (
    <button
      className={`selector-card companion-card ${isSelected ? 'selected' : ''}`}
      type="button"
      tabIndex={-1}
      aria-pressed={isSelected}
      onClick={blurOnClick(() => onSelectCharacter?.(character.id))}
    >
      {isSelected ? <div className="selector-cursor-tag">1P</div> : null}
      {character.portrait ? (
        <img className="selector-thumb" src={character.portrait} alt={character.name} />
      ) : (
        <div className="selector-thumb" style={{ background: character.color, borderRadius: '3px' }} />
      )}
      <div className="selector-name">{character.name.split(' ')[0]}</div>
    </button>
  );
}

function SelectorPlaceholder() {
  return (
    <div className="selector-card companion-card placeholder" aria-disabled="true">
      <div className="selector-placeholder-thumb">?</div>
      <div className="selector-name placeholder">Em breve</div>
    </div>
  );
}

const TOTAL_SLOTS = 4;

/** Home Screen (Aventura do Nicolas&Eloá): pixel art layout matching reference Image 2. */
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
  onSelectCharacter,
  onOpenLessonPicker,
  onOpenPhonePairing,
  onResetProgress,
}: MainMenuOptions) {
  const active = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? null;
  const currentCharacterId = selectedCharacterId || active?.characterId || CHARACTERS[0].id;
  const selectedChar = CHARACTERS.find((c) => c.id === currentCharacterId) ?? CHARACTERS[0];

  const bestTimeStr = speedrunBestTime != null ? formatTime(speedrunBestTime) : null;
  const speedrunText = bestTimeStr ? `⚡ Speed Run (${bestTimeStr})` : '⚡ Speed Run (A ao Z)';

  return (
    <div className="overlay home-screen">
      <div className="home-board">
        {/* --- 1. Header (Centered Logo + Tagline) --- */}
        <div className="home-header">
          <PixelLogo />
          <div className="home-tagline">PULE. DESCUBRA. BRINQUE.</div>
        </div>

        {/* --- 2. Character Selector Strip (KoF Small Thumbnails) --- */}
        <div className="home-selector-strip">
          <div className="home-section-title">ESCOLHA SEU PERSONAGEM</div>
          <div className="selector-grid companion-grid">
            {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
              const char = CHARACTERS[i];
              return char ? (
                <SelectorCard
                  key={char.id}
                  character={char}
                  isSelected={char.id === currentCharacterId}
                  onSelectCharacter={onSelectCharacter}
                />
              ) : (
                <SelectorPlaceholder key={`placeholder-${i}`} />
              );
            })}
          </div>
        </div>

        {/* --- 3. Main Stage --- */}
        <div className="home-main-stage">
          {/* Left Wing: Hero Showcase Panel */}
          <div className="hero-showcase-panel">
            <div className="hero-showcase-badge">JOGADOR PRONTO</div>
            <div className="hero-visual-stage">
              {selectedChar?.portrait ? (
                <div className="hero-portrait-frame">
                  <img
                    className="hero-large-portrait companion-avatar"
                    src={selectedChar.portrait}
                    alt={selectedChar.name}
                  />
                </div>
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
                <button className="btn-util" type="button" tabIndex={-1} onClick={blurOnClick(onResetProgress)}>
                  Zerar progresso
                </button>
                <button className="btn-util" type="button" tabIndex={-1} onClick={blurOnClick(onOpenPhonePairing)}>
                  📱 Controle por celular
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
