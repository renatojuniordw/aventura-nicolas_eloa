// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildSettingsScreen, settingsBack, touchPreviewWidth, type SettingsOptions } from './settings-v2.js';

function options(overrides: Partial<SettingsOptions> = {}): SettingsOptions {
  return {
    onOpenSection: vi.fn(),
    onOpenPhonePairing: vi.fn(),
    onOpenInstallGuide: vi.fn(),
    onResetProgress: vi.fn(),
    onBack: vi.fn(),
    audio: { musicVolume: 0.5, sfxVolume: 1, voiceVolume: 1 },
    experience: { supportLevel: 'assisted', highContrast: false, reducedMotion: false, largeText: false, colorVision: 'default' },
    onAudioChange: vi.fn(),
    onExperienceChange: vi.fn(),
    onOpenSupport: vi.fn(),
    onOpenGuardianInfo: vi.fn(),
    ...overrides,
  };
}

const buttons = (node: HTMLElement) => [...node.querySelectorAll('button')].map((b) => b.textContent?.trim());

describe('Configurações hub (docs/22 §4)', () => {
  it('shows six destinations and Voltar, without forms, preview or the destructive action', () => {
    const opts = options();
    const { node, cleanup } = buildSettingsScreen(opts);
    expect(buttons(node)).toEqual([
      '🔊Som e narração', '🤝Apoio para jogar', '👓Acessibilidade', '🎮Controles', '📲Aplicativo', '🛟Ajuda e dados', 'Voltar',
    ]);
    expect(node.querySelector('input, select, .touch-preview')).toBeNull();
    node.querySelector<HTMLButtonElement>('[data-nav-id="settings-access"]')!.click();
    expect(opts.onOpenSection).toHaveBeenCalledWith('access');
    cleanup();
  });

  it('goes up one level from every screen and leaves from the hub', () => {
    const opts = options();
    settingsBack(opts)();
    expect(opts.onBack).toHaveBeenCalled();
    settingsBack({ ...opts, section: 'audio' })();
    expect(opts.onOpenSection).toHaveBeenLastCalledWith(null);
    settingsBack({ ...opts, section: 'touch' })();
    expect(opts.onOpenSection).toHaveBeenLastCalledWith('controls');
  });
});

describe('Configurações screens', () => {
  it('Som e narração: three labelled volumes that apply at once', () => {
    const opts = options({ section: 'audio' });
    const { node, cleanup } = buildSettingsScreen(opts);
    const sliders = node.querySelectorAll<HTMLInputElement>('input[type="range"]');
    expect([...sliders].map((s) => s.getAttribute('aria-label'))).toEqual(['Volume de música', 'Volume de efeitos', 'Volume de voz']);
    expect(node.textContent).toContain('50%');
    cleanup();
  });

  it('Apoio para jogar: short choices, the full explanation kept (thorns in assisted)', () => {
    const opts = options({ section: 'support' });
    const { node, cleanup } = buildSettingsScreen(opts);
    const radios = [...node.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((r) => r.closest('label')?.textContent)).toEqual(['Assistido', 'Padrão', 'Desafio']);
    expect(radios[0]!.checked).toBe(true);
    expect(node.textContent).toContain('espinhos ainda tiram');
    expect(node.textContent).toContain('Vale a partir da próxima fase.');
    radios[2]!.click();
    expect(opts.onExperienceChange).toHaveBeenCalledWith({ supportLevel: 'challenge' });
    cleanup();
  });

  it('Acessibilidade: every preference is still there', () => {
    const { node, cleanup } = buildSettingsScreen(options({ section: 'access' }));
    expect(node.textContent).toContain('Alto contraste');
    expect(node.textContent).toContain('Texto ampliado');
    expect(node.textContent).toContain('Cores adaptadas');
    expect(node.textContent).toContain('Reduzir movimentos e flashes');
    cleanup();
  });

  it('Controles: touch entries only with touch controls, phone control always', () => {
    const withoutTouch = buildSettingsScreen(options({ section: 'controls' }));
    expect(buttons(withoutTouch.node)).toEqual(['📱Usar outro celular como controle', 'Voltar']);
    expect(withoutTouch.node.textContent).toContain('tela de toque');
    withoutTouch.cleanup();

    const touch = { layout: { size: 'default' as const, jumpSide: 'right' as const, edgeInset: 'near' as const }, onChange: vi.fn(), onReset: vi.fn(), onPractice: vi.fn() };
    const withTouch = buildSettingsScreen(options({ section: 'controls', touch }));
    expect(buttons(withTouch.node)).toEqual(['✋Ajustar toque', '🎮Treinar controles', '📱Usar outro celular como controle', 'Voltar']);
    withTouch.cleanup();
  });

  it('Ajustar toque: says "Restaurar controles" and falls back to Controles without touch', () => {
    const touch = { layout: { size: 'large' as const, jumpSide: 'left' as const, edgeInset: 'far' as const }, onChange: vi.fn(), onReset: vi.fn() };
    const { node, cleanup } = buildSettingsScreen(options({ section: 'touch', touch }));
    const reset = [...node.querySelectorAll('button')].find((b) => b.textContent?.includes('Restaurar controles'))!;
    expect(reset.disabled).toBe(false);
    reset.click();
    expect(touch.onReset).toHaveBeenCalled();
    cleanup();

    const fallback = buildSettingsScreen(options({ section: 'touch' }));
    expect(fallback.node.querySelector('h2')?.textContent).toBe('Controles');
    fallback.cleanup();
  });

  it('measures the real-size preview: the largest, farthest preset needs 326px of controls', () => {
    expect(touchPreviewWidth({ size: 'large', jumpSide: 'right', edgeInset: 'far' })).toBe(68 * 2 + 14 + 80 + 48 * 2 + 24 + 4);
    expect(touchPreviewWidth({ size: 'default', jumpSide: 'right', edgeInset: 'near' })).toBeLessThan(260);
  });

  it('Ajuda e dados: support, guardian information, and the reset set apart', () => {
    const opts = options({ section: 'help' });
    const { node, cleanup } = buildSettingsScreen(opts);
    const danger = node.querySelector('.settings-danger')!;
    expect(danger.textContent).toContain('Zerar progresso');
    expect(node.querySelector('.settings-hub')!.textContent).not.toContain('Zerar');
    danger.querySelector('button')!.click();
    expect(opts.onResetProgress).toHaveBeenCalled();
    cleanup();
  });
});
