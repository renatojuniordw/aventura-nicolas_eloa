// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'react-dom';
import { MenuOverlay } from './menu.js';
import { WORD_BANK } from '../content/word-bank.js';

function mainMenuOptions(overrides = {}) {
  return {
    onPlay: vi.fn(),
    onExplore: vi.fn(),
    onOpenDiscoveries: vi.fn(),
    onSpeedrun: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  };
}

function settingsOptions(overrides = {}) {
  return {
    audio: { musicVolume: 1, sfxVolume: 1, voiceVolume: 1 },
    experience: { supportLevel: 'standard', highContrast: false, reducedMotion: false, largeText: false, colorVision: 'default' },
    onAudioChange: vi.fn(),
    onExperienceChange: vi.fn(),
    onOpenSection: vi.fn(),
    onOpenInstallGuide: vi.fn(),
    onOpenPhonePairing: vi.fn(),
    onResetProgress: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
}

const button = (root, text) => [...root.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent).includes(text));

let root;
let menu;

/** A small overlay area, so collections split into pages (jsdom has no layout). */
function withViewport(width, height) {
  const saved = { width: window.innerWidth, height: window.innerHeight };
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
  return () => {
    Object.defineProperty(window, 'innerWidth', { value: saved.width, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: saved.height, configurable: true });
  };
}

const notebook = (count) => ({
  playerName: 'Eloá',
  words: WORD_BANK.slice(0, count).map((word) => ({ word, completed: true })),
  onOpenWord: vi.fn(),
  onExplore: vi.fn(),
  onBack: vi.fn(),
});
const cards = () => [...root.querySelectorAll('.discovery-card')].map((card) => card.dataset.navId);

beforeEach(() => {
  root = document.createElement('div');
  root.id = 'overlay-root';
  document.body.append(root);
  menu = new MenuOverlay({ root });
});

afterEach(() => {
  menu.hide();
  document.body.innerHTML = '';
});

describe('MenuOverlay navigation context (docs/18 §5)', () => {
  it('focuses the declared start control on a fresh screen', () => {
    menu.showMainMenu(mainMenuOptions());
    expect(document.activeElement?.textContent).toContain('Começar aventura');
  });

  it('returns to the control that opened the next screen, not to the first one', () => {
    menu.showMainMenu(mainMenuOptions());
    const settings = button(root, 'Configurações');
    settings.focus();
    settings.click();
    menu.showSettings(settingsOptions());
    expect(document.activeElement?.textContent).toBe('Voltar');

    menu.showMainMenu(mainMenuOptions());
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Configurações');
  });

  it('counts a tap without focus (iOS) as the origin', () => {
    menu.showMainMenu(mainMenuOptions());
    button(root, 'Caderno').click();
    document.body.focus();
    menu.showDiscoveries(notebook(0));
    menu.showMainMenu(mainMenuOptions());
    expect(document.activeElement?.textContent).toContain('Caderno');
  });

  it('keeps the focused control when a settings screen re-renders itself (a toggle)', () => {
    menu.showSettings(settingsOptions({ section: 'access' }));
    const toggle = [...root.querySelectorAll('input[type="checkbox"]')][1];
    toggle.focus();

    menu.showSettings(settingsOptions({ section: 'access' }));
    expect(document.activeElement).toBe([...root.querySelectorAll('input[type="checkbox"]')][1]);
  });

  it('returns from a settings section to the hub entry that opened it', () => {
    menu.showSettings(settingsOptions());
    root.querySelector('[data-nav-id="settings-audio"]').click();
    menu.showSettings(settingsOptions({ section: 'audio' }));
    menu.showSettings(settingsOptions());
    expect(document.activeElement?.dataset.navId).toBe('settings-audio');
  });

  it('keeps the notebook page and card across the word page and back (docs/22 M21)', () => {
    const restore = withViewport(400, 520);
    try {
      menu.showDiscoveries(notebook(9));
      const firstPage = cards();
      expect(firstPage.length).toBeLessThan(9);
      flushSync(() => button(root, 'Próxima').click());
      const secondPage = cards();
      expect(secondPage).not.toEqual(firstPage);
      root.querySelector(`[data-nav-id="${secondPage[0]}"]`).click();

      menu.showDiscoveryDetail({ ...notebook(1).words[0], onListen: vi.fn(), onReplay: vi.fn(), onBack: vi.fn() });
      expect(document.activeElement?.textContent).toContain('Ouvir');
      menu.showDiscoveries(notebook(9));
      expect(cards()).toEqual(secondPage);
      expect(document.activeElement?.dataset.navId).toBe(secondPage[0]);
    } finally {
      restore();
    }
  });

  it('opens a collection on its first page when it is not on the way back', () => {
    const restore = withViewport(400, 520);
    try {
      menu.showMainMenu(mainMenuOptions());
      menu.showDiscoveries(notebook(9));
      const firstPage = cards();
      flushSync(() => button(root, 'Próxima').click());
      menu.showMainMenu(mainMenuOptions());
      menu.showDiscoveries(notebook(9));
      expect(cards()).toEqual(firstPage);
    } finally {
      restore();
    }
  });

  it('falls back to the start control when the origin no longer exists', () => {
    menu.showMainMenu(mainMenuOptions());
    button(root, 'Caderno').focus();
    menu.showSettings(settingsOptions());
    menu.showMainMenu(mainMenuOptions({ onOpenDiscoveries: undefined }));
    expect(document.activeElement?.textContent).toContain('Começar aventura');
  });

  it('forgets the trail when the overlay hides (back to the game)', () => {
    menu.showMainMenu(mainMenuOptions());
    button(root, 'Configurações').focus();
    menu.showSettings(settingsOptions());
    menu.hide();
    menu.showMainMenu(mainMenuOptions());
    expect(document.activeElement?.textContent).toContain('Começar aventura');
  });
});

describe('MenuOverlay modal semantics', () => {
  it('names modal screens as dialogs and leaves the home as a page', () => {
    menu.showMainMenu(mainMenuOptions());
    expect(root.querySelector('[role="dialog"]')).toBeNull();

    menu.showSettings(settingsOptions());
    const dialog = root.querySelector('[role="dialog"]');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby'))?.textContent).toBe('Configurações');
  });

  it('pulls focus that escapes a modal back inside, but lets essential notices keep it', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    const banner = document.createElement('div');
    banner.className = 'update-banner';
    const update = document.createElement('button');
    banner.append(update);
    document.body.append(banner);

    menu.showSettings(settingsOptions());
    outside.focus();
    expect(root.contains(document.activeElement)).toBe(true);
    update.focus();
    expect(document.activeElement).toBe(update);
  });

  it('starts a destructive confirmation on Cancelar, which is also the keyboard default', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    menu.showConfirm({ title: 'Zerar progresso?', message: '...', confirmLabel: 'Sim, zerar', onConfirm, onCancel });
    expect(document.activeElement?.textContent).toBe('Cancelar');
    menu.triggerPrimary();
    menu.triggerBack();
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('starts the pause confirmation on Cancelar', () => {
    menu.showPause({ onResume: vi.fn(), onRestart: vi.fn(), onMenu: vi.fn(), onToggleMute: vi.fn() });
    expect(document.activeElement?.textContent).toBe('Continuar');
    button(root, 'Recomeçar').click();
    expect(document.activeElement?.textContent).toBe('Cancelar');
    button(root, 'Cancelar').click();
    expect(document.activeElement?.textContent).toBe('Recomeçar fase');
  });
});

describe('Escolher aventura (docs/20 §4 L1)', () => {
  const lessons = (states) => states.map((state, i) => ({ id: `l${i}`, target: `T${i}`, state, playable: state !== 'locked' }));
  const world = (overrides = {}) => ({
    id: 'pomar', title: 'Pomar das Sílabas', icon: '🍎', description: 'Famílias', done: 1, total: 3, current: true,
    units: [{ id: 'silabas-b', title: 'Família do B', done: 1, lessons: lessons(['done', 'next', 'locked']) }],
    ...overrides,
  });

  it('opens the map from the next-discovery plaque, without adding a home button', () => {
    const onOpenWorldMap = vi.fn();
    menu.showMainMenu(mainMenuOptions({ onOpenWorldMap, currentLessonTitle: 'Família do B' }));
    const plaque = root.querySelector('.discovery-plaque-btn');
    expect(plaque.getAttribute('aria-label')).toBe('Escolher aventura. Sua próxima descoberta: Família do B');
    plaque.click();
    expect(onOpenWorldMap).toHaveBeenCalled();
    // The play button keeps the start focus.
    expect(document.activeElement.textContent).toMatch(/aventura/);
    expect(document.activeElement.classList.contains('btn-primary-gold')).toBe(true);
  });

  it('lists worlds, says "Você está aqui" in text and focuses the current world', () => {
    const onOpenWorld = vi.fn();
    menu.showWorldList({
      worlds: [world({ id: 'jardim', title: 'Jardim das Letras', current: false }), world()],
      onOpenWorld,
      onBack: vi.fn(),
    });
    expect(root.textContent).toContain('Você está aqui');
    expect(document.activeElement.textContent).toContain('Pomar das Sílabas');
    menu.triggerPrimary();
    expect(onOpenWorld).toHaveBeenCalledWith('pomar');
  });

  it("lists a world's units and focuses the one holding the next lesson", () => {
    const onOpenUnit = vi.fn();
    const units = [
      { id: 'silabas-b', title: 'Família do B', done: 5, lessons: lessons(['done', 'done', 'done', 'done', 'done']) },
      { id: 'silabas-c', title: 'Família do C', done: 1, lessons: lessons(['done', 'next', 'locked']) },
    ];
    menu.showWorldDetail({ world: world({ units }), onOpenUnit, onBack: vi.fn() });
    expect(document.activeElement.getAttribute('aria-label')).toBe('Família do C, 1 de 3 fases, próxima descoberta aqui');
    menu.triggerPrimary();
    expect(onOpenUnit).toHaveBeenCalledWith('silabas-c');
  });

  it('plays done and next lessons, keeps the rest locked unless free practice is on', () => {
    const onPlayLesson = vi.fn();
    const onToggleFreePractice = vi.fn();
    const w = world();
    menu.showUnitLessons({ world: w, unit: w.units[0], freePractice: false, onPlayLesson, onToggleFreePractice, onBack: vi.fn() });
    const chips = [...root.querySelectorAll('.lesson-chip')];
    expect(chips.map((chip) => chip.disabled)).toEqual([false, false, true]);
    expect(chips[2].getAttribute('aria-label')).toBe('T2, ainda não liberada');
    expect(document.activeElement).toBe(chips[1]);
    chips[0].click();
    expect(onPlayLesson).toHaveBeenCalledWith('l0');
    button(root, 'Liberar todas').click();
    expect(onToggleFreePractice).toHaveBeenCalled();
  });

  it('opens a long unit on the page of the next lesson', () => {
    const restore = withViewport(400, 420);
    try {
      const states = Array.from({ length: 26 }, (_, i) => (i < 20 ? 'done' : i === 20 ? 'next' : 'locked'));
      const unit = { id: 'alfabeto', title: 'Alfabeto', done: 20, lessons: lessons(states) };
      menu.showUnitLessons({ world: world({ units: [unit] }), unit, freePractice: false, onPlayLesson: vi.fn(), onToggleFreePractice: vi.fn(), onBack: vi.fn() });
      const shown = [...root.querySelectorAll('.lesson-chip')];
      expect(shown.length).toBeLessThan(26);
      expect(document.activeElement.getAttribute('aria-label')).toBe('T20, próxima descoberta');
      expect(root.querySelector('.pager-status').textContent).toMatch(/^Página \d+ de \d+$/);
    } finally {
      restore();
    }
  });
});
