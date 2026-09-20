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

    // Cards exist (Nicolas + Eloá placeholder)
    const cards = node.querySelectorAll('.character-picker-card');
    expect(cards.length).toBeGreaterThanOrEqual(2);

    // Nicolas card is selected
    const nicolasCard = cards[0];
    expect(nicolasCard.classList.contains('selected')).toBe(true);
    expect(nicolasCard.textContent).toContain('Nicolas');

    // Eloá placeholder card exists
    const eloaCard = cards[1];
    expect(eloaCard.classList.contains('placeholder')).toBe(true);
    expect(eloaCard.textContent).toContain('Eloá');
    expect(eloaCard.textContent).toContain('Em breve');

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
