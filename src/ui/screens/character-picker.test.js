// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildCharacterPickerScreen } from './character-picker.js';

describe('buildCharacterPickerScreen', () => {
  it('renders the character picker with title, character cards, and action buttons', () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();
    const onBack = vi.fn();

    const { node, primary, back } = buildCharacterPickerScreen({
      selectedId: 'char-nicolas',
      onSelect,
      onConfirm,
      onBack,
    });

    const overlay = node.querySelector('.overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.classList.contains('character-picker-overlay')).toBe(true);
    expect(node.querySelector('h2').textContent).toContain('Escolha seu Personagem');

    // Cards exist: Nicolas, Eloá, and Novos Amigos placeholder
    const cards = node.querySelectorAll('.character-picker-card');
    expect(cards.length).toBe(3);

    // Nicolas card is selected
    const nicolasCard = cards[0];
    expect(nicolasCard.classList.contains('selected')).toBe(true);
    expect(nicolasCard.textContent).toContain('Nicolas');

    // Eloá card is available and playable
    const eloaCard = cards[1];
    expect(eloaCard.classList.contains('selected')).toBe(false);
    expect(eloaCard.textContent).toContain('Eloá');

    // Novos Amigos placeholder card exists
    const placeholderCard = cards[2];
    expect(placeholderCard.classList.contains('placeholder')).toBe(true);
    expect(placeholderCard.textContent).toContain('Novos Amigos');
    expect(placeholderCard.textContent).toContain('Em breve');

    // Buttons
    expect(typeof primary).toBe('function');
    expect(typeof back).toBe('function');
  });

  it('triggers onSelect when clicking a character card', () => {
    const onSelect = vi.fn();
    const { node } = buildCharacterPickerScreen({
      selectedId: null,
      onSelect,
      onConfirm: vi.fn(),
      onBack: vi.fn(),
    });

    const card = node.querySelector('.character-picker-card:not(.placeholder)');
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onSelect).toHaveBeenCalledWith('char-nicolas');
  });

  it('triggers onConfirm and onBack correctly', () => {
    const onConfirm = vi.fn();
    const onBack = vi.fn();

    const { primary, back } = buildCharacterPickerScreen({
      selectedId: 'char-nicolas',
      onSelect: vi.fn(),
      onConfirm,
      onBack,
    });

    primary();
    expect(onConfirm).toHaveBeenCalledTimes(1);

    back();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
