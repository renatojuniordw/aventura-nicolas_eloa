// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildLessonPickerScreen } from './lesson-picker.js';

describe('buildLessonPickerScreen', () => {
  const mockUnits = [
    {
      id: 'unit-1',
      title: 'Vogais',
      lessons: [
        { id: 'fase-a', target: 'A' },
        { id: 'fase-e', target: 'E' },
      ],
    },
    {
      id: 'unit-2',
      title: 'Consoantes',
      lessons: [
        { id: 'fase-b', target: 'B' },
      ],
    },
  ];

  it('renders unlocked lessons and responds to clicks', () => {
    const onPick = vi.fn();
    const onBack = vi.fn();
    const isUnlocked = vi.fn((id) => id === 'fase-a' || id === 'fase-b');

    const { node, primary, back } = buildLessonPickerScreen({
      units: mockUnits,
      isUnlocked,
      onPick,
      onBack,
    });

    expect(node.querySelector('h2').textContent).toContain('Escolha uma fase');
    const pickButtons = node.querySelectorAll('.lesson-pick-btn');
    expect(pickButtons.length).toBe(2);

    pickButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onPick).toHaveBeenCalledWith('fase-a');

    expect(typeof primary).toBe('function');
    expect(typeof back).toBe('function');
    back();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('displays locked message if no lessons in unit are unlocked', () => {
    const isUnlocked = vi.fn(() => false);
    const { node } = buildLessonPickerScreen({
      units: [mockUnits[0]],
      isUnlocked,
      onPick: vi.fn(),
      onBack: vi.fn(),
    });

    expect(node.querySelector('.lesson-unit-locked')).not.toBeNull();
  });
});
