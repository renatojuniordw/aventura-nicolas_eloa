/**
 * Tiny DOM helpers. Text is always set with `textContent` (never `innerHTML`),
 * so no string from content or user input can become markup.
 *
 * Used only by `touch-controls.ts` today: the D-pad builds a handful of
 * stable button elements once and toggles their presence in the DOM (shared,
 * by element identity, with `TouchAdapter`'s event listeners), which doesn't
 * fit React's mount/unmount-per-render model — see the comment in
 * `touch-controls.ts`. Every other DOM-building module in `ui/` is React/TSX.
 */

type ElProps = Record<string, unknown>;
type ElChild = Node | string | null | false | undefined;

export function el(tag: string, props: ElProps = {}, children: ElChild[] = []): HTMLElement {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'onClick' && typeof value === 'function') {
      node.addEventListener('click', (event) => {
        // Keep focus on the game surface, not on the button, so the keyboard
        // keeps driving the canvas after a click.
        if (typeof (node as HTMLElement & { blur?: () => void }).blur === 'function') node.blur();
        (value as (event: Event) => void)(event);
      });
    } else if (/^on[A-Z]/.test(key) && typeof value === 'function') {
      // Any other onX prop becomes a native listener (onSubmit, onInput, ...).
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'dataset' && typeof value === 'object' && value !== null) {
      Object.assign(node.dataset, value);
    } else {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }

  for (const child of ([] as ElChild[]).concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  return node;
}

/** Remove every child of a node. */
export function clear(node: Node): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

interface ButtonOptions {
  onClick?: (event: Event) => void;
  primary?: boolean;
  ariaPressed?: boolean | null;
}

/** A button that never steals keyboard focus. */
export function button(label: string, { onClick, primary = false, ariaPressed = null }: ButtonOptions = {}): HTMLElement {
  const props: ElProps = {
    class: primary ? 'primary' : '',
    text: label,
    type: 'button',
    tabindex: '-1',
  };
  if (onClick) props.onClick = onClick;
  if (ariaPressed !== null) props['aria-pressed'] = String(ariaPressed);
  return el('button', props);
}
