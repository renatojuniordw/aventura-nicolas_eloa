// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildPauseScreen } from './pause.js';

describe('buildPauseScreen', () => {
  it('renders the pause menu with resume, restart, menu and mute buttons', () => {
    const goTo = vi.fn();
    const { node, primary, back } = buildPauseScreen(
      'menu',
      {
        onResume: vi.fn(),
        onRestart: vi.fn(),
        onMenu: vi.fn(),
        isSpeedrun: false,
        isMuted: false,
        onToggleMute: vi.fn(),
      },
      goTo,
    );

    expect(node.classList.contains('overlay')).toBe(true);
    expect(node.querySelector('h2').textContent).toBe('Pausa');
    const buttons = node.querySelectorAll('button');
    expect(buttons.length).toBe(4);
    expect(buttons[0].textContent).toBe('Continuar');
    expect(buttons[1].textContent).toBe('Recomeçar fase');
    expect(buttons[2].textContent).toBe('Menu');
    expect(buttons[3].textContent).toContain('Som');
    expect(buttons[3].textContent).toContain('Ligado');
    expect(typeof primary).toBe('function');
    expect(typeof back).toBe('function');
  });

  it('shows muted label when audio is muted', () => {
    const goTo = vi.fn();
    const { node } = buildPauseScreen(
      'menu',
      { onResume: vi.fn(), onRestart: vi.fn(), onMenu: vi.fn(), isSpeedrun: false, isMuted: true, onToggleMute: vi.fn() },
      goTo,
    );

    const muteBtn = [...node.querySelectorAll('button')].find((b) => b.textContent.includes('Som'));
    expect(muteBtn.textContent).toContain('Mudo');
  });

  it('calls onResume through primary and back in menu step', () => {
    const onResume = vi.fn();
    const goTo = vi.fn();
    const { primary, back } = buildPauseScreen(
      'menu',
      { onResume, onRestart: vi.fn(), onMenu: vi.fn(), isSpeedrun: false, isMuted: false, onToggleMute: vi.fn() },
      goTo,
    );

    primary();
    expect(onResume).toHaveBeenCalledTimes(1);

    back();
    expect(onResume).toHaveBeenCalledTimes(2);
  });

  it('navigates to confirm-restart when restart button is clicked in menu step', () => {
    const onRestart = vi.fn();
    const goTo = vi.fn();
    const { node } = buildPauseScreen(
      'menu',
      { onResume: vi.fn(), onRestart, onMenu: vi.fn(), isSpeedrun: false, isMuted: false, onToggleMute: vi.fn() },
      goTo,
    );

    // Click the "Recomeçar fase" button (index 1)
    const restartBtn = node.querySelectorAll('button')[1];
    restartBtn.click();
    expect(goTo).toHaveBeenCalledWith('confirm-restart');
  });

  it('navigates to confirm-menu when menu button is clicked in menu step', () => {
    const goTo = vi.fn();
    const { node } = buildPauseScreen(
      'menu',
      { onResume: vi.fn(), onRestart: vi.fn(), onMenu: vi.fn(), isSpeedrun: false, isMuted: false, onToggleMute: vi.fn() },
      goTo,
    );

    const menuBtn = [...node.querySelectorAll('button')].find((b) => b.textContent.includes('Menu'));
    menuBtn.click();
    expect(goTo).toHaveBeenCalledWith('confirm-menu');
  });

  it('shows speedrun-specific warning in confirm-restart step', () => {
    const goTo = vi.fn();
    const { node } = buildPauseScreen(
      'confirm-restart',
      { onResume: vi.fn(), onRestart: vi.fn(), onMenu: vi.fn(), isSpeedrun: true, isMuted: false, onToggleMute: vi.fn() },
      goTo,
    );

    expect(node.querySelector('h2').textContent).toBe('Tem certeza?');
    const para = node.querySelector('p');
    expect(para.textContent).toContain('tempo desta corrida');
  });

  it('shows normal lesson warning in confirm-restart step', () => {
    const goTo = vi.fn();
    const { node } = buildPauseScreen(
      'confirm-restart',
      { onResume: vi.fn(), onRestart: vi.fn(), onMenu: vi.fn(), isSpeedrun: false, isMuted: false, onToggleMute: vi.fn() },
      goTo,
    );

    expect(node.querySelector('p').textContent).toContain('progresso desta fase');
  });

  it('shows menu-confirm message and cancel returns to menu step', () => {
    const onMenu = vi.fn();
    const goTo = vi.fn();
    const { node, back } = buildPauseScreen(
      'confirm-menu',
      { onResume: vi.fn(), onRestart: vi.fn(), onMenu, isSpeedrun: false, isMuted: false, onToggleMute: vi.fn() },
      goTo,
    );

    expect(node.querySelector('p').textContent).toContain('voltar para o menu');

    // Confirm action fires onMenu
    const confirm = [...node.querySelectorAll('button')].find((b) => b.textContent.includes('Sim'));
    confirm.click();
    expect(onMenu).toHaveBeenCalledTimes(1);

    // Back (Cancelar) goes back to menu step
    back();
    expect(goTo).toHaveBeenCalledWith('menu');
  });

  it('uses onRestart in confirm-restart step as primary action', () => {
    const onRestart = vi.fn();
    const goTo = vi.fn();
    const { primary } = buildPauseScreen(
      'confirm-restart',
      { onResume: vi.fn(), onRestart, onMenu: vi.fn(), isSpeedrun: false, isMuted: false, onToggleMute: vi.fn() },
      goTo,
    );

    primary();
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('treats unknown step as confirm-menu', () => {
    const goTo = vi.fn();
    const { node } = buildPauseScreen(
      'unknown-step',
      { onResume: vi.fn(), onRestart: vi.fn(), onMenu: vi.fn(), isSpeedrun: false, isMuted: false, onToggleMute: vi.fn() },
      goTo,
    );

    expect(node.querySelector('p').textContent).toContain('voltar para o menu');
  });
});