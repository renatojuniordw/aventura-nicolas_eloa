// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createPixelLogoSvg } from './pixel-logo.js';

describe('createPixelLogoSvg', () => {
  it('creates an SVG element with the proper title and aria-label', () => {
    const svg = createPixelLogoSvg();
    expect(svg).toBeTruthy();
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('aria-label')).toBe('Aventura do Nicolas & Eloá');
  });

  it('renders both rows with accentuation and letter O', () => {
    const svg = createPixelLogoSvg();
    const textElements = svg.querySelectorAll('text');
    expect(textElements.length).toBe(2);
    expect(textElements[0].textContent).toBe('Aventura do');
    expect(textElements[1].textContent).toBe('Nicolas & Eloá');
  });

  it('accepts custom rows', () => {
    const svg = createPixelLogoSvg(['Fase 1', 'Começar!']);
    const textElements = svg.querySelectorAll('text');
    expect(textElements[0].textContent).toBe('Fase 1');
    expect(textElements[1].textContent).toBe('Começar!');
  });
});
