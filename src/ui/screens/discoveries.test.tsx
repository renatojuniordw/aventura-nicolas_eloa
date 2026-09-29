// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildDiscoveriesScreen, buildDiscoveryDetailScreen } from './discoveries.js';
import { buildExploreVictoryScreen } from './victory.js';
import { WORD_BANK } from '../../content/word-bank.js';

const bola = WORD_BANK.find(word => word.id === 'bola')!;

describe('discovery screens', () => {
  it('invites an empty notebook to explore and supports back', () => {
    const options = { playerName: 'Eloá', words: [], onOpenWord: vi.fn(), onExplore: vi.fn(), onBack: vi.fn() };
    const screen = buildDiscoveriesScreen(options);
    expect(screen.node.textContent).toContain('primeira palavra');
    screen.primary?.();
    screen.back?.();
    expect(options.onExplore).toHaveBeenCalledOnce();
    expect(options.onBack).toHaveBeenCalledOnce();
    screen.cleanup();
  });

  it('lists only provided discoveries as one button each, distinguishing visits from completions', () => {
    const entry = { word: bola, completed: false };
    const options = { playerName: 'Eloá', words: [entry], onOpenWord: vi.fn(), onExplore: vi.fn(), onBack: vi.fn() };
    const screen = buildDiscoveriesScreen(options);
    expect(screen.node.querySelectorAll('.discovery-card')).toHaveLength(1);
    expect(screen.node.textContent).toContain('Palavra visitada');
    expect(screen.node.textContent).not.toContain('Palavra montada');
    // The catalog stays short: the sentence lives on the word's own page.
    expect(screen.node.textContent).not.toContain(bola.fact);
    expect(screen.node.querySelector('img')?.getAttribute('src')).toBe('/assets/words/bola.svg');
    // Everything fits one page: no page controls.
    expect(screen.node.querySelector('.pager')).toBeNull();
    screen.node.querySelector<HTMLButtonElement>('.discovery-card')!.click();
    expect(options.onOpenWord).toHaveBeenCalledWith(entry);
    screen.cleanup();
  });

  it("shows a word's sentence with working listen/replay/back on its own page", () => {
    const options = { word: bola, completed: true, onListen: vi.fn(), onReplay: vi.fn(), onBack: vi.fn() };
    const screen = buildDiscoveryDetailScreen(options);
    expect(screen.node.textContent).toContain(bola.fact);
    expect(screen.node.textContent).toContain('Palavra montada');
    screen.node.querySelector<HTMLButtonElement>('[aria-label="Ouvir BOLA"]')!.click();
    screen.node.querySelector<HTMLButtonElement>('[aria-label="Jogar BOLA novamente"]')!.click();
    expect(options.onListen).toHaveBeenCalledWith(bola);
    expect(options.onReplay).toHaveBeenCalledWith(bola);
    screen.back?.();
    expect(options.onBack).toHaveBeenCalledOnce();
    screen.cleanup();
  });

  it('makes stopping the primary action at the end of a journey and permits another', () => {
    const options = { word: 'BOLA', illustration: bola, journeyWords: [bola], journeyComplete: true, stars: 3, mistakes: 0, hasNext: true, onNext: vi.fn(), onReplay: vi.fn(), onMenu: vi.fn() };
    const screen = buildExploreVictoryScreen(options);
    expect(screen.node.textContent).toContain('Jornada concluída!');
    expect(screen.node.textContent).toContain('Seu progresso está salvo');
    screen.primary?.();
    expect(options.onMenu).toHaveBeenCalledOnce();
    const next = [...screen.node.querySelectorAll('button')].find(button => button.textContent === 'Começar outra jornada')!;
    next.click();
    expect(options.onNext).toHaveBeenCalledOnce();
    screen.cleanup();
  });
});
