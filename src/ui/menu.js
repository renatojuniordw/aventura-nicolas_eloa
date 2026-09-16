import { button, clear, el } from './dom.js';
import { CHARACTERS } from '../content/characters.js';
import { POSE_FRAMES } from '../render/atlas-meta.js';
import { createPixelLogoSvg } from './pixel-logo.js';

/** Which frame of the celebrate sheet reads best as a static victory pose. */
const VICTORY_FRAME_INDEX = 2;

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
  }

  get isVisible() {
    return this._visible;
  }

  hide() {
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

  _mount(node, { primary = null, back = null } = {}) {
    clear(this._root);
    this._root.append(node);
    this._primary = primary;
    this._back = back;
    this._visible = true;
  }

  // --- Screens -------------------------------------------------------------

  /**
   * Home Screen (Aventura das Letras):
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
      onPlay,
      onSelectProfile,
      onCreateProfile,
      onSelectCharacter,
      onOpenCharacterPicker,
      onOpenLessonPicker,
      onResetProgress,
    } = options;

    const active = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? null;
    const currentCharacterId = selectedCharacterId || active?.characterId || CHARACTERS[0].id;

    // --- Left Column ---
    // 1. Pixel art Logo + semantic accessible h1
    const logoNode = el('div', { class: 'pixel-logo-wrapper' }, [
      el('h1', { class: 'sr-only', text: 'Aventura das Letras' }),
      createPixelLogoSvg(),
    ]);

    // 2. Tagline
    const tagline = el('div', { class: 'home-tagline', text: 'PULE. DESCUBRA. BRINQUE.' });

    // 3. Profiles section: "QUEM VAI BRINCAR?"
    const profileTitle = el('div', { class: 'home-section-title', text: 'QUEM VAI BRINCAR?' });

    const profileButtons = profiles.slice(0, 2).map((profile) => {
      const isSelected = profile.id === activeProfileId;
      return el('button', {
        class: `profile-tab ${isSelected ? 'selected' : ''}`,
        type: 'button',
        tabindex: '-1',
        text: (isSelected ? '● ' : '') + profile.name,
        onClick: () => onSelectProfile(profile.id),
      });
    });

    // Convidado / Novo profile tab
    const guestSelected = !activeProfileId || profiles.length === 0;
    profileButtons.push(
      el('button', {
        class: `profile-tab ${guestSelected ? 'selected' : ''}`,
        type: 'button',
        tabindex: '-1',
        text: (guestSelected ? '● ' : '') + (active ? '+ Novo jogador' : 'Convidado'),
        onClick: () => this._showNameForm(onCreateProfile, () => this.showMainMenu(options)),
      }),
    );

    const profileRow = el('div', { class: 'profile-tab-row' }, profileButtons);

    // 4. Companions section: "ESCOLHA SEU COMPANHEIRO"
    const companionTitle = el('div', { class: 'home-section-title', text: 'ESCOLHA SEU COMPANHEIRO' });

    const companionCards = CHARACTERS.map((char) => {
      const isSelected = char.id === currentCharacterId;
      const isAvailable = char.available !== false;

      const avatar = char.portrait
        ? el('img', {
            class: 'companion-avatar',
            src: char.portrait,
            alt: char.name,
          })
        : el('div', {
            class: 'companion-swatch',
            style: `background: ${char.color}`,
          });

      const nameLabel = el('div', { class: 'companion-name', text: char.name });
      const badge = !isAvailable
        ? el('span', { class: 'companion-status-badge', text: 'Em breve' })
        : null;

      return el(
        'button',
        {
          class: `companion-card ${isSelected ? 'selected' : ''} ${!isAvailable ? 'disabled' : ''}`,
          type: 'button',
          tabindex: '-1',
          'aria-pressed': String(isSelected),
          onClick: () => {
            if (isAvailable && onSelectCharacter) {
              onSelectCharacter(char.id);
            } else if (!isAvailable) {
              // Informative behavior when clicking a companion in development
              alert(`${char.name} estará disponível em breve com novos superpoderes!`);
            }
          },
        },
        [avatar, nameLabel, badge],
      );
    });

    const companionGrid = el('div', { class: 'companion-grid' }, companionCards);

    const leftColumn = el('div', { class: 'home-col-left' }, [
      logoNode,
      tagline,
      profileTitle,
      profileRow,
      companionTitle,
      companionGrid,
    ]);

    // --- Right Column ---
    const discoveryTitle = el('div', { class: 'discovery-title', text: 'SUA PRÓXIMA DESCOBERTA' });
    const discoveryTarget = el('div', { class: 'discovery-target', text: currentLessonTitle });

    const btnStart = el('button', {
      class: 'btn-retro btn-primary-gold',
      type: 'button',
      tabindex: '-1',
      text: active && completedCount > 0 ? 'Continuar aventura' : 'Começar aventura',
      onClick: onPlay,
    });

    const btnSpeedrun = el('button', {
      class: 'btn-retro btn-secondary-green',
      type: 'button',
      tabindex: '-1',
      text: 'Speed Run',
      onClick: () => onPlay(),
    });

    const btnStages = el('button', {
      class: 'btn-retro btn-secondary-green',
      type: 'button',
      tabindex: '-1',
      text: 'Escolher fase',
      onClick: onOpenLessonPicker,
    });

    const btnPowers = el('button', {
      class: 'btn-retro btn-secondary-green',
      type: 'button',
      tabindex: '-1',
      text: 'Poderes e duração',
      onClick: () => this.showControls({ onBack: () => this.showMainMenu(options) }),
    });

    const btnSensor = el('button', {
      class: 'btn-util',
      type: 'button',
      tabindex: '-1',
      text: 'Com sensor',
      onClick: () => {
        alert('Modo teclado e controle nativo ativo. ESP32 desabilitado no momento.');
      },
    });

    const btnSettings = el('button', {
      class: 'btn-util',
      type: 'button',
      tabindex: '-1',
      text: 'Ajustes',
      onClick: () => this.showControls({ onBack: () => this.showMainMenu(options) }),
    });

    const btnExit = el('button', {
      class: 'btn-util',
      type: 'button',
      tabindex: '-1',
      text: active ? 'Zerar' : 'Sair',
      onClick: active ? onResetProgress : () => this.showControls({ onBack: () => this.showMainMenu(options) }),
    });

    const utilRow = el('div', { class: 'home-util-row' }, [btnSensor, btnSettings, btnExit]);
    const subStatus = el('div', {
      class: 'home-substatus',
      text: `Aventura contínua · ${completedCount} de ${totalLessons} fases`,
    });

    const rightColumn = el('div', { class: 'home-col-right' }, [
      discoveryTitle,
      discoveryTarget,
      btnStart,
      btnSpeedrun,
      btnStages,
      btnPowers,
      utilRow,
      subStatus,
    ]);

    // --- Footer Tips ---
    const footerTips = el('div', {
      class: 'home-footer-tips',
      text: 'Setas ou controle para escolher · Enter para brincar',
    });

    const board = el('div', { class: 'home-board' }, [leftColumn, rightColumn]);
    const screen = el('div', { class: 'overlay home-screen' }, [board, footerTips]);

    this._mount(screen, { primary: onPlay, back: null });
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

  showPause({ onResume, onRestart, onMenu }) {
    const screen = el('div', { class: 'overlay' }, [
      el('h2', { text: 'Pausa' }),
      el('p', { text: 'Respire fundo e continue quando quiser.' }),
      el('div', { class: 'overlay-actions' }, [
        button('Continuar', { primary: true, onClick: onResume }),
        button('Recomeçar fase', { onClick: onRestart }),
        button('Menu', { onClick: onMenu }),
      ]),
    ]);
    this._mount(screen, { primary: onResume, back: onResume });
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

  showControls({ onBack }) {
    const screen = el('div', { class: 'overlay' }, [
      el('h2', { text: 'Como jogar' }),
      el('p', {
        text: 'Colete o item pedido no topo da tela. Cada erro custa um coração. Cair no buraco não custa coração — você volta para o mesmo lugar.',
      }),
      this._controlsHelp(),
      el('div', { class: 'overlay-actions' }, [button('Voltar', { primary: true, onClick: onBack })]),
    ]);
    this._mount(screen, { primary: onBack, back: onBack });
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

  _showNameForm(onSubmit, onCancel) {
    const input = el('input', {
      type: 'text',
      maxlength: '24',
      placeholder: 'Nome do jogador',
      'aria-label': 'Nome do jogador',
      style:
        'font-family:var(--font-pixel);font-size:0.9rem;padding:10px 14px;border-radius:4px;border:3px solid var(--color-ink);background:var(--color-cream);color:var(--color-ink);text-align:center;box-shadow:0 3px 0 var(--color-green-dark);',
    });

    const submit = () => {
      const name = input.value.trim();
      onSubmit(name === '' ? 'Jogador' : name);
    };

    const form = el(
      'form',
      {
        class: 'overlay-actions',
        onSubmit: (event) => {
          event.preventDefault();
          submit();
        },
      },
      [
        input,
        el('button', { type: 'submit', class: 'primary', tabindex: '-1', text: 'Criar' }),
        button('Cancelar', { onClick: () => (onCancel ? onCancel() : this.hide()) }),
      ],
    );

    const screen = el('div', { class: 'overlay' }, [
      el('h2', { text: 'Quem vai jogar?' }),
      form,
    ]);

    this._mount(screen, {
      primary: submit,
      back: onCancel ?? null,
    });
    input.focus();
  }

  _controlsHelp() {
    return el('div', { class: 'controls-help' }, [
      el('span', {}, [el('kbd', { text: '←' }), ' ', el('kbd', { text: '→' }), ' ou ', el('kbd', { text: 'A' }), ' ', el('kbd', { text: 'D' }), ' andar   ']),
      el('span', {}, [el('kbd', { text: 'Espaço' }), ' pular   ']),
      el('span', {}, [el('kbd', { text: 'Esc' }), ' pausar   ']),
      el('span', {}, [el('kbd', { text: 'Enter' }), ' confirmar']),
    ]);
  }
}
