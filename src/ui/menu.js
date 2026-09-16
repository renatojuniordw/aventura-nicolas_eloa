import { button, clear, el } from './dom.js';
import { CHARACTERS } from '../content/characters.js';
import { POSE_FRAMES } from '../render/atlas-meta.js';
import { createPixelLogoSvg } from './pixel-logo.js';
import { formatTime } from '../content/text-utils.js';

/** Which frame of the celebrate sheet reads best as a static victory pose. */
const VICTORY_FRAME_INDEX = 2;

/**
 * Animates a 2x2 sprite sheet (like celebrate pose) on an HTML5 canvas.
 * @param {string} imageSrc
 * @param {number} width
 * @param {number} height
 * @returns {{ canvas: HTMLCanvasElement|null, stop: () => void }}
 */
function createCelebrationCanvas(imageSrc, width = 120, height = 120) {
  if (typeof document === 'undefined') return { canvas: null, stop: () => {} };

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.className = 'hero-celebrate-canvas';

  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return { canvas, stop: () => {} };

  const img = new Image();
  img.src = imageSrc;

  let frame = 0;
  let animId = null;
  let lastTime = 0;
  const frameDuration = 180; // ms per frame

  function step(time) {
    if (img.complete && img.naturalWidth > 0) {
      if (!lastTime || time - lastTime >= frameDuration) {
        lastTime = time;
        frame = (frame + 1) % 4; // 2x2 celebrate frame grid
      }
      const col = frame % 2;
      const row = Math.floor(frame / 2);
      const fw = img.naturalWidth / 2;
      const fh = img.naturalHeight / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, canvas.width, canvas.height);
    }
    animId = requestAnimationFrame(step);
  }

  animId = requestAnimationFrame(step);

  return {
    canvas,
    stop: () => {
      if (animId) cancelAnimationFrame(animId);
    },
  };
}

/**
 * DOM overlay screens: main menu, character picker, phase picker, pause, game
 * over and victory. All copy is in Brazilian Portuguese.
 *
 * Screens are click-driven AND keyboard-driven: each mounted screen registers a
 * primary and a back action, which the scenes trigger from the abstracted
 * CONFIRM/BACK actions. So menus obey the same input abstraction as gameplay.
 */
export class MenuOverlay {
  /** @param {{ root: HTMLElement }} options */
  constructor({ root }) {
    this._root = root;
    this._visible = false;
    this._primary = null;
    this._back = null;
    this._cleanup = null;
  }

  get isVisible() {
    return this._visible;
  }

  hide() {
    this._cleanup?.();
    this._cleanup = null;
    clear(this._root);
    this._visible = false;
    this._primary = null;
    this._back = null;
  }

  triggerPrimary() {
    this._primary?.();
  }

  triggerBack() {
    this._back?.();
  }

  _mount(node, { primary = null, back = null, cleanup = null } = {}) {
    this._cleanup?.();
    this._cleanup = cleanup;
    clear(this._root);
    this._root.append(node);
    this._primary = primary;
    this._back = back;
    this._visible = true;
  }

  // --- Screens -------------------------------------------------------------

  /**
   * Home Screen (Aventura do Nicolas&Eloá):
   * Pixel art layout matching reference Image 2.
   */
  showMainMenu(options) {
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
      text: `Aventura contínua · ${completedCount} de ${totalLessons} fases`,
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

    const screen = el('div', { class: 'overlay home-screen' }, [board, footerTips]);

    this._mount(screen, {
      primary: onPlay,
      back: null,
      cleanup: () => {
        if (animHandle) animHandle();
      },
    });
  }

  showCharacterPicker({ selectedId, onSelect, onConfirm, onBack }) {
    const cards = CHARACTERS.map((character) =>
      el(
        'button',
        {
          class: 'companion-card',
          type: 'button',
          tabindex: '-1',
          'aria-pressed': String(character.id === selectedId),
          onClick: () => onSelect(character.id),
        },
        [
          character.portrait
            ? el('img', {
                class: 'companion-avatar',
                src: character.portrait,
                alt: character.name,
              })
            : el('span', {
                class: 'companion-swatch',
                style: `background:${character.color}`,
              }),
          el('span', { class: 'companion-name', text: character.name }),
        ],
      ),
    );

    const screen = el('div', { class: 'overlay' }, [
      el('h2', { text: 'Escolha seu personagem' }),
      el('div', { class: 'character-grid' }, cards),
      el('div', { class: 'overlay-actions' }, [
        button('Pronto', { primary: true, onClick: onConfirm }),
        button('Voltar', { onClick: onBack }),
      ]),
    ]);

    this._mount(screen, { primary: onConfirm, back: onBack });
  }

  /**
   * @param {{ units: Array, isUnlocked: (lessonId: string) => boolean, onPick, onBack }} options
   */
  showLessonPicker({ units, isUnlocked, onPick, onBack }) {
    const groups = units.map((unit) => {
      const lessons = unit.lessons.filter((lesson) => isUnlocked(lesson.id));
      return el('div', {}, [
        el('h2', { text: unit.title }),
        el(
          'div',
          { class: 'overlay-actions' },
          lessons.length > 0
            ? lessons.map((lesson) =>
                button(lesson.target, { onClick: () => onPick(lesson.id) }),
              )
            : [el('p', { text: 'Conclua a fase anterior para liberar.' })],
        ),
      ]);
    });

    const screen = el('div', { class: 'overlay' }, [
      el('h2', { text: 'Escolha uma fase' }),
      el('div', { class: 'overlay-scroll' }, groups),
      el('div', { class: 'overlay-actions' }, [button('Voltar', { primary: true, onClick: onBack })]),
    ]);

    this._mount(screen, { primary: onBack, back: onBack });
  }

  /**
   * The pause screen is a tiny state machine rendered into the same overlay
   * node: 'menu' (default) or a 'confirm-restart'/'confirm-menu' step that
   * guards the two destructive actions. There is no overlay-stacking
   * mechanism in this class, so re-rendering in place is simpler than
   * mounting a second screen on top.
   */
  showPause({ onResume, onRestart, onMenu, isSpeedrun = false, isMuted = false, onToggleMute }) {
    this._renderPauseScreen('menu', { onResume, onRestart, onMenu, isSpeedrun, isMuted, onToggleMute });
  }

  _renderPauseScreen(step, { onResume, onRestart, onMenu, isSpeedrun, isMuted, onToggleMute }) {
    const goTo = (nextStep) =>
      this._renderPauseScreen(nextStep, { onResume, onRestart, onMenu, isSpeedrun, isMuted, onToggleMute });

    if (step === 'menu') {
      const screen = el('div', { class: 'overlay' }, [
        el('h2', { text: 'Pausa' }),
        el('p', { text: 'Respire fundo e continue quando quiser.' }),
        el('div', { class: 'overlay-actions' }, [
          button('Continuar', { primary: true, onClick: onResume }),
          button('Recomeçar fase', { onClick: () => goTo('confirm-restart') }),
          button('Menu', { onClick: () => goTo('confirm-menu') }),
          button(isMuted ? '🔇 Som: Mudo' : '🔈 Som: Ligado', { onClick: onToggleMute }),
        ]),
      ]);
      this._mount(screen, { primary: onResume, back: onResume });
      return;
    }

    const isRestart = step === 'confirm-restart';
    const confirmAction = isRestart ? onRestart : onMenu;
    const message = isRestart
      ? isSpeedrun
        ? 'Você vai perder o tempo desta corrida e recomeçar do zero.'
        : 'Você vai perder o progresso desta fase.'
      : 'Você vai voltar para o menu e perder o progresso desta fase.';

    const screen = el('div', { class: 'overlay' }, [
      el('h2', { text: 'Tem certeza?' }),
      el('p', { text: message }),
      el('div', { class: 'overlay-actions' }, [
        button('Sim, confirmar', { primary: true, onClick: confirmAction }),
        button('Cancelar', { onClick: () => goTo('menu') }),
      ]),
    ]);
    this._mount(screen, { primary: confirmAction, back: () => goTo('menu') });
  }

  showGameOver({ lesson, onRetry, onMenu }) {
    const screen = el('div', { class: 'overlay' }, [
      el('h2', { text: 'Acabaram os corações' }),
      el('p', { text: `Vamos tentar de novo: ${lesson?.objective ?? ''}` }),
      el('div', { class: 'overlay-actions' }, [
        button('Tentar de novo', { primary: true, onClick: onRetry }),
        button('Menu', { onClick: onMenu }),
      ]),
    ]);
    this._mount(screen, { primary: onRetry, back: onMenu });
  }

  showVictory({ lesson, character, stars, mistakes, hasNext, onNext, onReplay, onMenu }) {
    const starRow = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
    const celebrateImage = character?.sprites?.celebrate;
    const screen = el('div', { class: 'overlay' }, [
      el('h1', { text: 'Muito bem!' }),
      celebrateImage ? this._celebrateBadge(celebrateImage, character.name) : null,
      el('h2', { text: `Você coletou ${lesson?.target ?? ''}` }),
      el('p', { text: `${starRow}   (${mistakes} erro${mistakes === 1 ? '' : 's'})` }),
      el('div', { class: 'overlay-actions' }, [
        hasNext ? button('Próxima fase', { primary: true, onClick: onNext }) : null,
        button('Jogar de novo', { onClick: onReplay }),
        button('Menu', { onClick: onMenu }),
      ]),
    ]);
    this._mount(screen, { primary: hasNext ? onNext : onReplay, back: onMenu });
  }

  showSpeedrunVictory({
    character,
    elapsed = 0,
    mistakes = 0,
    isNewBest = false,
    bestTime = 0,
    totalLetters = 26,
    onReplay,
    onMenu,
  }) {
    const timeStr = formatTime(elapsed);
    const bestStr = formatTime(bestTime);
    const celebrateImage = character?.sprites?.celebrate;

    const screen = el('div', { class: 'overlay' }, [
      el('h1', { text: isNewBest ? '🏆 NOVO RECORDE!' : '🏁 Maratona Concluída!' }),
      celebrateImage ? this._celebrateBadge(celebrateImage, character.name) : null,
      el('h2', { text: `Tempo da Corrida: ⏱️ ${timeStr}` }),
      el('p', {
        text: isNewBest
          ? '⭐ Esse foi o seu melhor tempo pessoal!'
          : `Melhor tempo salvo: ${bestStr}`,
      }),
      el('p', {
        text: `Todas as ${totalLetters} letras coletadas com ${mistakes} erro${mistakes === 1 ? '' : 's'}!`,
      }),
      el('div', { class: 'overlay-actions' }, [
        button('Correr de novo ⚡', { primary: true, onClick: onReplay }),
        button('Menu principal', { onClick: onMenu }),
      ]),
    ]);
    this._mount(screen, { primary: onReplay, back: onMenu });
  }

  // --- Internals -----------------------------------------------------------

  /** One static frame cropped from the celebrate sprite sheet via CSS. */
  _celebrateBadge(celebrateImage, name) {
    const { columns, rows } = POSE_FRAMES.celebrate;
    const column = VICTORY_FRAME_INDEX % columns;
    const row = Math.floor(VICTORY_FRAME_INDEX / columns);
    const posX = columns > 1 ? (column / (columns - 1)) * 100 : 0;
    const posY = rows > 1 ? (row / (rows - 1)) * 100 : 0;
    return el('div', {
      class: 'victory-celebrate',
      role: 'img',
      'aria-label': name,
      style: `background-image:url(${celebrateImage});background-size:${columns * 100}% ${rows * 100}%;background-position:${posX}% ${posY}%;`,
    });
  }
}
