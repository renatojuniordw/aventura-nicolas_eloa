// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildPrivacyNoticeScreen } from './privacy-notice.js';

describe('buildPrivacyNoticeScreen', () => {
  it('renders the parental notice with title, explanation and confirm button', () => {
    const onConfirm = vi.fn();
    const { node, primary, back } = buildPrivacyNoticeScreen({ onConfirm });

    expect(node.classList.contains('overlay')).toBe(true);
    expect(node.classList.contains('privacy-notice')).toBe(true);
    // The title mentions responsible adults
    expect(node.querySelector('h2').textContent).toContain('responsáveis');
    // The article text explains local-only storage
    const paragraphs = node.querySelectorAll('p');
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(paragraphs[0].textContent).toContain('neste aparelho');
    // The confirm button has the expected label
    const confirmBtn = node.querySelector('button');
    expect(confirmBtn.textContent).toBe('Entendi, pode começar');
  });

  it('calls onConfirm when the button is clicked', () => {
    const onConfirm = vi.fn();
    const { node, primary } = buildPrivacyNoticeScreen({ onConfirm });

    primary();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('wires the confirm action as primary and leaves back as null (not dismissable)', () => {
    const { primary, back } = buildPrivacyNoticeScreen({ onConfirm: vi.fn() });

    expect(typeof primary).toBe('function');
    expect(back).toBeNull();
  });
});