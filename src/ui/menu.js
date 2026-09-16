import { button, clear, el } from './dom.js';
import { CHARACTERS } from '../content/characters.js';
import { POSE_FRAMES } from '../render/atlas-meta.js';

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

  showMainMenu(options) {
    const {
      profiles,
      activeProfileId,
      completedCount = 0,
      totalLessons = 0,
      onPlay,
      onSelectProfile,
      onCreateProfile,
      onOpenCharacterPicker,
      onOpenLessonPicker,
      onResetProgress,
    } = options;
    const active = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? null;

    const profileList = el('div', { class: 'profile-list' }, [
      ...profiles.map((profile) =>
        button(profile.name, {
          primary: profile.id === activeProfileId,
          ariaPressed: profile.id === activeProfileId,
          onClick: () => onSelectProfile(profile.id),
        }),
      ),
      button('+ Novo jogador', { onClick: () => this._showNameForm(onCreateProfile, () => this.showMainMenu(options)) }),
    ]);

    const progressText = active
      ? `Fases concluídas: ${completedCount} de ${totalLessons}`
      : 'Crie um jogador para começar';

    const screen = el('div', { class: 'overlay' }, [
      el('h1', { text: 'Aventura das Letras' }),
      el('p', { text: 'Escolha quem vai jogar e colete a letra certa!' }),
      el('h2', { text: active ? `Jogador: ${active.name}` : 'Nenhum jogador ainda' }),
      profileList,
      el('p', { text: progressText }),
      el('div', { class: 'overlay-actions' }, [
        button('Jogar', { primary: true, onClick: onPlay }),
        active
          ? button('Trocar personagem', {
              onClick: () => onOpenCharacterPicker(active.characterId),
            })
          : null,
        button('Escolher fase', { onClick: onOpenLessonPicker }),
        active ? button('Zerar progresso', { onClick: onResetProgress }) : null,
      ]),
      this._controlsHelp(),
    ]);

    this._mount(screen, { primary: onPlay, back: null });
  }

  showCharacterPicker({ selectedId, onSelect, onConfirm, onBack }) {
    const cards = CHARACTERS.map((character) =>
      el(
        'button',
        {
          class: 'character-card',
          type: 'button',
          tabindex: '-1',
          'aria-pressed': String(character.id === selectedId),
          onClick: () => onSelect(character.id),
        },
        [
          character.portrait
            ? el('img', {
                class: 'character-portrait',
                src: character.portrait,
                alt: character.name,
              })
            : el('span', {
                class: 'character-swatch',
                style: `background:${character.color}`,
              }),
          el('span', { text: character.name }),
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
        'font:inherit;padding:10px 12px;border-radius:10px;border:2px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:inherit;text-align:center;',
    });

    const submit = () => {
      const name = input.value.trim();
      onSubmit(name === '' ? 'Jogador' : name);
    };

    // A real <form> gives us Enter-to-submit for free — no raw key listener,
    // so the input layer stays the only place that knows about keystrokes.
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
