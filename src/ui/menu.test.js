// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    onOpenInstallGuide: vi.fn(),
    onOpenPhonePairing: vi.fn(),
    onResetProgress: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
}

const button = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(text));

let root;
let menu;

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
    expect(document.activeElement?.textContent).toContain('Configurações');
  });

  it('counts a tap without focus (iOS) as the origin', () => {
    menu.showMainMenu(mainMenuOptions());
    button(root, 'Caderno').click();
    document.body.focus();
    menu.showDiscoveries({ playerName: 'Eloá', words: [], onListen: vi.fn(), onReplay: vi.fn(), onExplore: vi.fn(), onBack: vi.fn() });
    menu.showMainMenu(mainMenuOptions());
    expect(document.activeElement?.textContent).toContain('Caderno');
  });

  it('restores the scroll of a screen that re-renders itself (a settings toggle)', () => {
    menu.showSettings(settingsOptions());
    const panel = root.querySelector('.settings-screen');
    panel.scrollTop = 240;
    const toggle = [...root.querySelectorAll('input[type="checkbox"]')][1];
    toggle.focus();

    menu.showSettings(settingsOptions());
    expect(root.querySelector('.settings-screen').scrollTop).toBe(240);
    expect(document.activeElement).toBe([...root.querySelectorAll('input[type="checkbox"]')][1]);
  });

  it('keeps the notebook position across a nested screen and back', () => {
    const words = WORD_BANK.slice(0, 6).map((word) => ({ word, completed: true }));
    const discoveries = { playerName: 'Eloá', words, onListen: vi.fn(), onReplay: vi.fn(), onExplore: vi.fn(), onBack: vi.fn() };
    menu.showDiscoveries(discoveries);
    root.querySelector('.discoveries-screen').scrollTop = 500;
    root.querySelector(`[aria-label="Ouvir ${words[4].word.label}"]`).focus();
    menu.showSettings(settingsOptions());
    menu.showDiscoveries(discoveries);
    expect(root.querySelector('.discoveries-screen').scrollTop).toBe(500);
    expect(document.activeElement?.getAttribute('aria-label')).toBe(`Ouvir ${words[4].word.label}`);
  });

  it('opens a screen fresh when it is not on the way back', () => {
    const words = WORD_BANK.slice(0, 3).map((word) => ({ word, completed: true }));
    const discoveries = { playerName: 'Eloá', words, onListen: vi.fn(), onReplay: vi.fn(), onExplore: vi.fn(), onBack: vi.fn() };
    menu.showMainMenu(mainMenuOptions());
    menu.showDiscoveries(discoveries);
    root.querySelector('.discoveries-screen').scrollTop = 300;
    menu.showMainMenu(mainMenuOptions());
    menu.showDiscoveries(discoveries);
    expect(root.querySelector('.discoveries-screen').scrollTop).toBe(0);
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
