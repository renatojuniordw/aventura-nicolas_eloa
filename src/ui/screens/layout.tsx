import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { MenuButton } from './menu-button.js';
import { consumePageAnchor, PAGER_ANCHOR_ATTR, PAGER_ATTR } from '../navigation-context.js';

/*
 * Shared composition for menu screens (docs/22 §2 and §8): screens fit the
 * usable area instead of scrolling, and collections are split into explicit
 * pages with Anterior/Próxima. Space is read from the real overlay area (its
 * padding already holds the safe areas), never from a device name or the
 * orientation alone, and in rem so "Texto ampliado" gets fewer, not smaller,
 * items per page.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Area extends Size {
  /** CSS px per rem (16 by default, more with "Texto ampliado"). */
  rem: number;
}

function readArea(): Area {
  const fallback = { width: 1024, height: 768, rem: 16 };
  if (typeof window === 'undefined') return fallback;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const root = document.getElementById('overlay-root');
  const box = root?.getBoundingClientRect();
  if (root && box && box.width > 0 && box.height > 0) {
    const style = getComputedStyle(root);
    return {
      width: box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      height: box.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
      rem,
    };
  }
  return { width: window.innerWidth || fallback.width, height: window.innerHeight || fallback.height, rem };
}

const sameSize = (a: Size, b: Size) => Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

/** The overlay's usable area, kept current across rotation and browser-bar changes. */
export function useArea(): Area {
  const [area, setArea] = useState(readArea);
  useEffect(() => {
    const update = () => setArea((previous) => {
      const next = readArea();
      return sameSize(previous, next) && previous.rem === next.rem ? previous : next;
    });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);
    update();
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);
  return area;
}

/**
 * The rendered size of a box with a definite size (a `.screen-body` inside a
 * `.screen-fill` panel), or `estimate` until the browser has laid it out.
 */
export function useBoxSize(ref: RefObject<HTMLElement | null>, estimate: Size): Size {
  const [size, setSize] = useState<Size | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || box.width <= 0 || box.height <= 0) return;
      setSize((previous) => (previous && sameSize(previous, box) ? previous : { width: box.width, height: box.height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size ?? estimate;
}

/**
 * The content box of a panel filling `area`: its padding and border (about
 * 2.5rem across) and `chromeRem` of title, pager and footer taken out.
 * Used before the browser has laid out a screen, or when a screen does not
 * fill the area.
 */
export function panelBox(area: Area, chromeRem: number): Size {
  return { width: area.width - 2.5 * area.rem, height: area.height - chromeRem * area.rem };
}

/** How many items of `item` px fit in `space` px with `gap` between them (at least one). */
export function fitCount(space: number, item: number, gap: number): number {
  return Math.max(1, Math.floor((space + gap) / (item + gap)));
}

/** Columns × rows of a grid whose cells are at least `cell` (rem) in `box` px. */
export function gridCapacity(box: Size, rem: number, cell: { width: number; height: number; gap?: number; maxColumns?: number }): number {
  const gap = (cell.gap ?? 0.75) * rem;
  const columns = Math.min(cell.maxColumns ?? Infinity, fitCount(box.width, cell.width * rem, gap));
  return columns * fitCount(box.height, cell.height * rem, gap);
}

export interface Pager<T> {
  id: string;
  page: number;
  pageCount: number;
  capacity: number;
  total: number;
  items: T[];
  /** Stable id of the first item on the page: what navigation remembers. */
  anchorId: string | null;
  go: (page: number) => void;
}

/**
 * One page of `items`. The page is derived from an anchor item id rather than
 * stored as a number, so when the capacity changes (rotation, text size) the
 * item that was on screen stays on screen, and a missing anchor (other player,
 * filtered list) falls back to the first page. `start` opens on the page
 * holding that item (e.g. the next lesson); a remembered page wins over it.
 */
export function usePager<T>({ id, items, getId, capacity, start = null }: {
  id: string;
  items: readonly T[];
  getId: (item: T) => string;
  capacity: number;
  start?: string | null;
}): Pager<T> {
  const [anchor, setAnchor] = useState<string | null>(() => consumePageAnchor(id) ?? start);
  const perPage = Math.max(1, Math.floor(capacity));
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const at = anchor == null ? -1 : items.findIndex((item) => getId(item) === anchor);
  const page = Math.min(pageCount - 1, at === -1 ? 0 : Math.floor(at / perPage));
  const pageItems = items.slice(page * perPage, page * perPage + perPage);
  return {
    id,
    page,
    pageCount,
    capacity: perPage,
    total: items.length,
    items: pageItems,
    anchorId: pageItems[0] ? getId(pageItems[0]) : null,
    go: (next) => {
      const target = Math.max(0, Math.min(pageCount - 1, next));
      const first = items[target * perPage];
      if (first) setAnchor(getId(first));
    },
  };
}

/**
 * Anterior · "Página 2 de 5" · Próxima. Hidden when everything fits. At a
 * limit the arrow stays in place and keeps focus (`aria-disabled`, not
 * `disabled`), so paging with the keyboard never drops focus to the page.
 * The position is announced politely. No swipe, no auto-advance.
 */
export function PaginationControls({ pager, label, itemNoun }: {
  pager: Pager<unknown>;
  /** Accessible name of the navigation, e.g. "Páginas do caderno". */
  label: string;
  /** With one item per page, "Palavra 2 de 12" reads better than "Página 2 de 12". */
  itemNoun?: string;
}) {
  if (pager.pageCount <= 1) return null;
  const { page, pageCount } = pager;
  const status = itemNoun && pager.capacity === 1 ? `${itemNoun} ${page + 1} de ${pager.total}` : `Página ${page + 1} de ${pageCount}`;
  const arrow = (direction: -1 | 1) => {
    const blocked = direction < 0 ? page === 0 : page === pageCount - 1;
    return (
      <MenuButton
        className="pager-btn"
        data-nav-id={`${pager.id}-${direction < 0 ? 'prev' : 'next'}`}
        aria-disabled={blocked || undefined}
        onClick={() => { if (!blocked) pager.go(page + direction); }}
      >
        {direction < 0 ? <><span aria-hidden="true">◀ </span>Anterior</> : <>Próxima<span aria-hidden="true"> ▶</span></>}
      </MenuButton>
    );
  };
  return (
    <nav className="pager" aria-label={label} {...{ [PAGER_ATTR]: pager.id, [PAGER_ANCHOR_ATTR]: pager.anchorId ?? '' }}>
      {/* Status first in DOM so it is read before the arrows; CSS centres it between them when there is room. */}
      <div className="pager-row">
        <p className="pager-status" aria-live="polite">{status}</p>
        {arrow(-1)}
        {arrow(1)}
      </div>
    </nav>
  );
}
