/**
 * Escapes XML special characters for safe SVG embedding.
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an SVG element for the authentic retro pixel art title "Aventura do Nicolas&Eloá".
 * Uses the retro font "Silkscreen" with pixel outlines and styled highlights,
 * supporting the full character set including accents (á), 'O', and '&'.
 *
 * @param {string[]} [customRows] - Optional array of rows to render.
 * @returns {Element} SVG element
 */
export function createPixelLogoSvg(customRows) {
  const rows = customRows || ['Aventura do', 'Nicolas & Eloá'];
  const row1 = escapeXml(rows[0] ?? '');
  const row2 = escapeXml(rows[1] ?? '');

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 76" class="pixel-logo-svg" role="img" aria-label="${escapeXml(rows.join(' '))}">
      <defs>
        <filter id="pixel-title-shadow" x="-10%" y="-10%" width="130%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="0" flood-color="#142622" flood-opacity="1" />
        </filter>
      </defs>
      <style>
        .pixel-logo-text {
          font-family: var(--font-pixel, "Silkscreen", monospace, sans-serif);
          font-weight: 700;
          text-anchor: middle;
          paint-order: stroke fill;
          user-select: none;
        }
        .pixel-logo-row1 {
          font-size: 22px;
          fill: var(--color-gold, #ffd479);
          stroke: #182e29;
          stroke-width: 4px;
          stroke-linejoin: miter;
          letter-spacing: 2px;
        }
        .pixel-logo-row2 {
          font-size: 26px;
          fill: var(--color-cream, #fbf4df);
          stroke: #182e29;
          stroke-width: 4.5px;
          stroke-linejoin: miter;
          letter-spacing: 1.5px;
        }
      </style>
      <g filter="url(#pixel-title-shadow)">
        <text x="190" y="30" class="pixel-logo-text pixel-logo-row1">${row1}</text>
        <text x="190" y="64" class="pixel-logo-text pixel-logo-row2">${row2}</text>
      </g>
    </svg>
  `.trim();

  if (typeof document === 'undefined') {
    return null;
  }

  const container = document.createElement('div');
  container.className = 'pixel-logo-wrapper';
  container.innerHTML = svgString;
  return container.firstElementChild;
}
