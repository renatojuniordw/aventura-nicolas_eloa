// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { flushSync } from 'react-dom';
import { mountScreen } from './mount-screen.js';
import { fitCount, gridCapacity, PaginationControls, usePager } from './layout.js';
import { providePageAnchors } from '../navigation-context.js';

const ITEMS = Array.from({ length: 7 }, (_, i) => `w${i}`);

let pagerRef: ReturnType<typeof usePager<string>> | null = null;

function Harness({ capacity, items = ITEMS, start = null }: { capacity: number; items?: string[]; start?: string | null }) {
  const pager = usePager({ id: 'test', items, getId: (item) => item, capacity, start });
  pagerRef = pager;
  return (
    <div>
      <ul>{pager.items.map((item) => <li key={item}>{item}</li>)}</ul>
      <PaginationControls pager={pager} label="Páginas" itemNoun="Palavra" />
    </div>
  );
}

const shown = (node: HTMLElement) => [...node.querySelectorAll('li')].map((li) => li.textContent);
const arrow = (node: HTMLElement, text: string) => [...node.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!;

afterEach(() => {
  pagerRef = null;
  providePageAnchors(null);
});

describe('fitCount / gridCapacity', () => {
  it('counts whole items with gaps and never less than one', () => {
    expect(fitCount(100, 30, 5)).toBe(3);
    expect(fitCount(10, 30, 5)).toBe(1);
    expect(gridCapacity({ width: 420, height: 200 }, 16, { width: 12.5, height: 5.75, gap: 0.75 })).toBe(4);
  });
});

describe('usePager and PaginationControls (docs/22 §8)', () => {
  it('pages through every item exactly once, with position and limits', () => {
    const { node, cleanup } = mountScreen(<Harness capacity={3} />);
    document.body.append(node);
    const seen: string[] = [];
    seen.push(...shown(node));
    expect(node.querySelector('.pager-status')?.textContent).toBe('Página 1 de 3');
    expect(arrow(node, 'Anterior').getAttribute('aria-disabled')).toBe('true');
    flushSync(() => arrow(node, 'Próxima').click());
    seen.push(...shown(node));
    flushSync(() => arrow(node, 'Próxima').click());
    seen.push(...shown(node));
    expect(seen).toEqual(ITEMS);
    // At the last page the arrow stays (and keeps focus) but does nothing.
    const next = arrow(node, 'Próxima');
    next.focus();
    expect(next.getAttribute('aria-disabled')).toBe('true');
    flushSync(() => next.click());
    expect(shown(node)).toEqual(['w6']);
    expect(document.activeElement).toBe(next);
    cleanup();
    node.remove();
  });

  it('names the position by item when a page holds one item', () => {
    const { node, cleanup } = mountScreen(<Harness capacity={1} />);
    expect(node.querySelector('.pager-status')?.textContent).toBe('Palavra 1 de 7');
    cleanup();
  });

  it('keeps the item on screen when the capacity changes (rotation, text size)', () => {
    const { node, cleanup } = mountScreen(<Harness capacity={2} />);
    flushSync(() => pagerRef!.go(2));
    expect(shown(node)).toEqual(['w4', 'w5']);
    cleanup();
    const wider = mountScreen(<Harness capacity={3} start="w4" />);
    expect(shown(wider.node)).toContain('w4');
    wider.cleanup();
  });

  it('starts on the page of `start`, and a remembered page wins over it', () => {
    const fresh = mountScreen(<Harness capacity={3} start="w5" />);
    expect(shown(fresh.node)).toEqual(['w3', 'w4', 'w5']);
    fresh.cleanup();

    providePageAnchors([['test', 'w0']]);
    const returning = mountScreen(<Harness capacity={3} start="w5" />);
    providePageAnchors(null);
    expect(shown(returning.node)).toEqual(['w0', 'w1', 'w2']);
    expect(returning.node.querySelector('[data-pager-id="test"]')?.getAttribute('data-pager-anchor')).toBe('w0');
    returning.cleanup();
  });

  it('falls back to the first page when the remembered item is gone (other player)', () => {
    providePageAnchors([['test', 'missing']]);
    const { node, cleanup } = mountScreen(<Harness capacity={3} />);
    providePageAnchors(null);
    expect(shown(node)).toEqual(['w0', 'w1', 'w2']);
    cleanup();
  });

  it('shows no page controls when everything fits', () => {
    const { node, cleanup } = mountScreen(<Harness capacity={10} />);
    expect(node.querySelector('.pager')).toBeNull();
    expect(shown(node)).toEqual(ITEMS);
    cleanup();
  });
});
