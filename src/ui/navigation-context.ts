/**
 * Transient "where was I?" state for the overlay screens (docs/18 §5): which
 * control opened the next screen and how far each scroll container was
 * scrolled. Lives in memory only — never mixed with learning progress, never
 * persisted across sessions or orientations.
 */
export interface NavContext {
  /** Stable id of the control last focused/activated (see `navIdOf`). */
  focusId: string | null;
  /** Scroll offsets keyed by `scrollKeyOf`. */
  scroll: Array<[string, number]>;
}

const CONTROL = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A stable identifier for a control, so it can be found again after its screen
 * is rebuilt. Explicit `data-nav-id` wins; otherwise the accessible name that
 * does not change between renders (id, aria-label, name, label or text).
 */
export function navIdOf(target: Element | null): string | null {
  const control = target?.closest?.(`[data-nav-id], ${CONTROL}`);
  if (!control) return null;
  const explicit = control.closest('[data-nav-id]')?.getAttribute('data-nav-id');
  if (explicit) return `nav:${explicit}`;
  if (control.id) return `id:${control.id}`;
  const label = control.getAttribute('aria-label');
  if (label) return `label:${label}`;
  const name = control.getAttribute('name');
  if (name) return `name:${name}`;
  const text = (control.closest('label')?.textContent ?? control.textContent ?? '').trim();
  return text ? `text:${control.tagName}:${text}` : null;
}

/** Finds the control that `navIdOf` would describe with `id`. */
export function findByNavId(root: ParentNode, id: string | null): HTMLElement | null {
  if (!id) return null;
  for (const element of root.querySelectorAll<HTMLElement>(`[data-nav-id], ${CONTROL}`)) {
    if (navIdOf(element) === id && isFocusable(element)) return element;
  }
  return null;
}

function isFocusable(element: HTMLElement): boolean {
  return !(element as HTMLButtonElement).disabled && !element.closest('[inert], [hidden]');
}

function scrollKeyOf(element: Element, root: Element): string {
  const cls = typeof element.className === 'string' ? element.className : '';
  const same = [...root.querySelectorAll('*')].filter((other) => other.tagName === element.tagName && other.className === cls);
  return `${element.tagName}.${cls}#${same.indexOf(element)}`;
}

/** Every scrolled container inside `root`, with a key that survives a rebuild. */
export function captureScroll(root: Element): Array<[string, number]> {
  const entries: Array<[string, number]> = [];
  for (const element of root.querySelectorAll('*')) {
    if (element.scrollTop > 0) entries.push([scrollKeyOf(element, root), element.scrollTop]);
  }
  return entries;
}

/** Re-applies captured offsets to containers that still exist (the browser clamps them). */
export function restoreScroll(root: Element, entries: Array<[string, number]>): void {
  if (!entries.length) return;
  const byKey = new Map(entries);
  for (const element of root.querySelectorAll('*')) {
    const top = byKey.get(scrollKeyOf(element, root));
    if (top !== undefined) element.scrollTop = top;
  }
}

/** Where a freshly mounted screen puts focus: its declared start, else its first control. */
export function initialFocusOf(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-autofocus]') ?? root.querySelector<HTMLElement>(CONTROL);
}

/** Focusable controls, in DOM order, for keeping Tab inside a modal. */
export function focusablesIn(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(CONTROL)].filter(isFocusable);
}
