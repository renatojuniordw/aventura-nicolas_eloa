// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { mountScreen } from './mount-screen.js';
import { WordPicture } from './word-picture.js';
import { WORD_BANK } from '../../content/word-bank.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const bola = WORD_BANK.find((word) => word.id === 'bola')!;

function fire(target: EventTarget, type: string) {
  act(() => {
    target.dispatchEvent(new Event(type));
  });
}

describe('WordPicture (docs/18 §6)', () => {
  it('reserves its box while loading and marks itself ready on load', () => {
    const { node, cleanup } = mountScreen(<WordPicture word={bola} />);
    const img = node.querySelector('img')!;
    expect(img.dataset.state).toBe('loading');
    expect(img.getAttribute('width')).toBe('128');
    fire(img, 'load');
    expect(node.querySelector('img')!.dataset.state).toBe('ready');
    cleanup();
  });

  it('shows the word instead of a broken image, and retries once when the network returns', () => {
    const { node, cleanup } = mountScreen(<WordPicture word={bola} />);
    fire(node.querySelector('img')!, 'error');
    const fallback = node.querySelector('.word-picture-fallback')!;
    expect(fallback.getAttribute('role')).toBe('img');
    expect(fallback.getAttribute('aria-label')).toBe('Ilustração indisponível: bola');
    expect(fallback.textContent).toBe('BOLA');

    fire(window, 'online');
    expect(node.querySelector('img')).not.toBeNull();
    fire(node.querySelector('img')!, 'error');
    expect(node.querySelector('.word-picture-fallback')).not.toBeNull();

    // Attempts are capped: another "online" does not request it again.
    fire(window, 'online');
    expect(node.querySelector('img')).toBeNull();
    cleanup();
  });

  it('lazy-loads pictures that are not requested eagerly', () => {
    const { node, cleanup } = mountScreen(<WordPicture word={bola} eager={false} />);
    expect(node.querySelector('img')!.getAttribute('loading')).toBe('lazy');
    cleanup();
  });
});
