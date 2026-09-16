import { el } from '../dom.js';
import { CHARACTERS } from '../../content/characters.js';
import { createPixelLogoSvg } from '../pixel-logo.js';
import { formatTime } from '../../content/text-utils.js';
import { createCelebrationCanvas } from './celebration-canvas.js';

/**
 * Home Screen (Aventura do Nicolas&Eloá): pixel art layout matching reference Image 2.
 * @returns {{ node: HTMLElement, primary: () => void, back: null, cleanup: () => void }}
 */
export function buildMainMenuScreen(options) {
  const {
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
    onResetProgress,
  } = options;

  const active = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? null;
  const currentCharacterId = selectedCharacterId || active?.characterId || CHARACTERS[0].id;
  const selectedChar = CHARACTERS.find((c) => c.id === currentCharacterId) ?? CHARACTERS[0];

  // --- 1. Header (Centered Logo + Tagline) ---
  const logoNode = el('div', { class: 'pixel-logo-wrapper' }, [
    el('h1', { class: 'sr-only', text: 'Aventura do Nicolas&Eloá' }),
    createPixelLogoSvg(),
  ]);

  const tagline = el('div', { class: 'home-tagline', text: 'PULE. DESCUBRA. BRINQUE.' });
  const header = el('div', { class: 'home-header' }, [logoNode, tagline]);

  // --- 2. Character Selector Strip (KoF Small Thumbnails) ---
  const selectorTitle = el('div', { class: 'home-section-title', text: 'ESCOLHA SEU PERSONAGEM' });
  const selectorCards = [];
  const TOTAL_SLOTS = 4;

  for (let i = 0; i < TOTAL_SLOTS; i += 1) {
    const char = CHARACTERS[i];
    if (char) {
      const isSelected = char.id === currentCharacterId;
      const thumb = char.portrait
        ? el('img', {
            class: 'selector-thumb',
            src: char.portrait,
            alt: char.name,
          })
        : el('div', {
            class: 'selector-thumb',
            style: `background: ${char.color}; border-radius: 3px;`,
          });

      const nameLabel = el('div', { class: 'selector-name', text: char.name.split(' ')[0] });
      const cardChildren = [];
      if (isSelected) {
        cardChildren.push(el('div', { class: 'selector-cursor-tag', text: '1P' }));
      }
      cardChildren.push(thumb, nameLabel);

      selectorCards.push(
        el(
          'button',
          {
            class: `selector-card companion-card ${isSelected ? 'selected' : ''}`,
            type: 'button',
            tabindex: '-1',
            'aria-pressed': String(isSelected),
            onClick: () => {
              if (onSelectCharacter) onSelectCharacter(char.id);
            },
          },
          cardChildren,
        ),
      );
    } else {
      selectorCards.push(
        el(
          'div',
          {
            class: 'selector-card companion-card placeholder',
            'aria-disabled': 'true',
          },
          [
            el('div', { class: 'selector-placeholder-thumb', text: '?' }),
            el('div', { class: 'selector-name placeholder', text: 'Em breve' }),
          ],
        ),
      );
    }
  }

  const selectorGrid = el('div', { class: 'selector-grid companion-grid' }, selectorCards);
  const selectorStrip = el('div', { class: 'home-selector-strip' }, [selectorTitle, selectorGrid]);

  // --- 3. Main Stage ---
  // Left Wing: Hero Showcase Panel (Giant Portrait + Animated Victory/Happy Sprite!)
  let animHandle = null;
  const visualChildren = [];

  if (selectedChar?.portrait) {
    visualChildren.push(
      el('div', { class: 'hero-portrait-frame' }, [
        el('img', {
          class: 'hero-large-portrait companion-avatar',
          src: selectedChar.portrait,
          alt: selectedChar.name,
        }),
      ]),
    );
  }

  if (selectedChar?.sprites?.celebrate) {
    const { canvas, stop } = createCelebrationCanvas(selectedChar.sprites.celebrate, 120, 120);
    animHandle = stop;
    if (canvas) {
      visualChildren.push(
        el('div', { class: 'hero-animation-stage' }, [
          canvas,
          el('div', { class: 'hero-podium-pedestal' }),
        ]),
      );
    }
  }

  const heroBadge = el('div', { class: 'hero-showcase-badge', text: 'JOGADOR PRONTO' });
  const heroVisualStage = el('div', { class: 'hero-visual-stage' }, visualChildren);
  const heroNamePlate = el('div', { class: 'hero-name-plate', text: `⭐ ${selectedChar?.name ?? 'Nicolas Gomes'}` });
  const heroFlavor = el('div', { class: 'hero-flavor-text', text: 'Pronto para pular, descobrir e brincar!' });
  const heroFooter = el('div', { class: 'hero-showcase-footer' }, [heroNamePlate, heroFlavor]);

  const heroShowcasePanel = el('div', { class: 'hero-showcase-panel' }, [
    heroBadge,
    heroVisualStage,
    heroFooter,
  ]);

  // Right Wing: Action Menu Panel (High Usability)
  const discoveryTitle = el('div', { class: 'discovery-title', text: 'SUA PRÓXIMA DESCOBERTA' });
  const discoveryTarget = el('div', { class: 'discovery-target', text: currentLessonTitle });
  const discoveryPlaque = el('div', { class: 'discovery-plaque' }, [discoveryTitle, discoveryTarget]);

  const btnStart = el('button', {
    class: 'btn-retro btn-primary-gold',
    type: 'button',
    tabindex: '-1',
    text: active && completedCount > 0 ? 'Continuar aventura' : 'Começar aventura',
    onClick: onPlay,
  });

  const bestTimeStr = speedrunBestTime != null ? formatTime(speedrunBestTime) : null;
  const speedrunText = bestTimeStr
    ? `⚡ Speed Run (${bestTimeStr})`
    : '⚡ Speed Run (A ao Z)';

  const btnSpeedrun = el('button', {
    class: 'btn-retro btn-secondary-green',
    type: 'button',
    tabindex: '-1',
    text: speedrunText,
    onClick: onSpeedrun,
  });

  const btnStages = el('button', {
    class: 'btn-retro btn-secondary-green',
    type: 'button',
    tabindex: '-1',
    text: 'Escolher fase',
    onClick: onOpenLessonPicker,
  });

  const btnReset = el('button', {
    class: 'btn-util',
    type: 'button',
    tabindex: '-1',
    text: 'Zerar progresso',
    onClick: onResetProgress,
  });

  const subStatus = el('div', {
    class: 'home-substatus',
    text: `A aventura continua · ${completedCount} de ${totalLessons} fases`,
  });

  const menuMetaRow = el('div', { class: 'menu-meta-row home-meta-row' }, [btnReset, subStatus]);

  const menuButtonsGroup = el('div', { class: 'menu-buttons-group home-btn-group' }, [
    btnStart,
    btnSpeedrun,
    btnStages,
    menuMetaRow,
  ]);

  const menuPanel = el('div', { class: 'home-menu-panel' }, [
    discoveryPlaque,
    menuButtonsGroup,
  ]);

  const mainStage = el('div', { class: 'home-main-stage' }, [
    heroShowcasePanel,
    menuPanel,
  ]);

  // --- 4. Footer Tips ---
  const footerTips = el('div', {
    class: 'home-footer-tips',
    text: 'Setas ou controle para escolher · Enter para brincar',
  });

  const board = el('div', { class: 'home-board' }, [
    header,
    selectorStrip,
    mainStage,
  ]);

  const node = el('div', { class: 'overlay home-screen' }, [board, footerTips]);

  return {
    node,
    primary: onPlay,
    back: null,
    cleanup: () => {
      if (animHandle) animHandle();
    },
  };
}
