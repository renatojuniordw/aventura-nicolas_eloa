/**
 * Tiny DOM helpers. Text is always set with `textContent` (never `innerHTML`),
 * so no string from content or user input can become markup.
 */

/**
 * @param {string} tag
 * @param {Record<string, unknown>} [props]
 * @param {Array<Node|string|null|false>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'onClick' && typeof value === 'function') {
      node.addEventListener('click', (event) => {
        // Keep focus on the game surface, not on the button, so the keyboard
        // keeps driving the canvas after a click.
        if (typeof node.blur === 'function') node.blur();
        value(event);
      });
    } else if (/^on[A-Z]/.test(key) && typeof value === 'function') {
      // Any other onX prop becomes a native listener (onSubmit, onInput, ...).
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value);
    } else {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }

  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  return node;
}

/** Remove every child of a node. */
export function clear(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

/** A button that never steals keyboard focus. */
export function button(label, { onClick, primary = false, ariaPressed = null } = {}) {
  const props = {
    class: primary ? 'primary' : '',
    text: label,
    type: 'button',
    tabindex: '-1',
  };
  if (onClick) props.onClick = onClick;
  if (ariaPressed !== null) props['aria-pressed'] = String(ariaPressed);
  return el('button', props);
}
