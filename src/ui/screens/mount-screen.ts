import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { MouseEvent, ReactNode } from 'react';

/**
 * Renders a React element into a container `<div>` and hands it back as
 * `node`, so screen builders keep returning the same `{ node, primary, back,
 * cleanup }` shape `MenuOverlay` has always consumed — React is an
 * implementation detail of each screen, not something `menu.ts` needs to
 * know about.
 *
 * `node` IS the container React's root was created on, not its rendered
 * child — React 18's event system delegates every event through a listener
 * attached to that exact container, not to `document`. An earlier version of
 * this helper returned `container.firstElementChild` instead (to avoid this
 * wrapper `<div>` in the DOM) and moved *that* into `MenuOverlay`'s root; the
 * button's own click handlers then silently stopped firing in a real
 * browser, because the click events bubbled through the *new* parent
 * (`MenuOverlay`'s root), which React was never told to listen on — the
 * child had been extracted from the one container that mattered. Moving
 * `node` itself is safe (its children go with it), so it must stay the
 * thing every caller moves around.
 *
 * `MenuOverlay` (and every caller of a `buildXScreen` function) expects
 * `node` synchronously, so the render is wrapped in `flushSync` — React 18+
 * otherwise schedules the initial commit rather than performing it inline.
 */
export function mountScreen(element: ReactNode): { node: HTMLElement; cleanup: () => void } {
  const node = document.createElement('div');
  const root = createRoot(node);
  flushSync(() => root.render(element));
  return { node, cleanup: () => root.unmount() };
}

/**
 * Wraps a click handler so the button blurs itself first, mirroring the
 * original `ui/dom.js` `el()` helper's `onClick` behavior: keeps focus on the
 * game surface (canvas) instead of on the button, so the keyboard keeps
 * driving the game after a click instead of the browser moving focus.
 */
export function blurOnClick(handler?: () => void) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur();
    handler?.();
  };
}
