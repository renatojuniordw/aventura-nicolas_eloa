const GLYPHS = {
  A: ['01110', '11011', '11011', '11111', '11011', '11011', '11011'],
  V: ['11011', '11011', '11011', '11011', '11011', '01110', '00100'],
  E: ['11111', '11000', '11000', '11110', '11000', '11000', '11111'],
  N: ['11001', '11101', '11101', '11011', '11011', '11011', '11001'],
  T: ['11111', '11111', '00100', '00100', '00100', '00100', '00100'],
  U: ['11011', '11011', '11011', '11011', '11011', '11011', '01110'],
  R: ['11110', '11011', '11011', '11110', '11100', '11010', '11011'],
  D: ['11110', '11011', '11011', '11011', '11011', '11011', '11110'],
  S: ['01111', '11000', '11000', '01110', '00011', '00011', '11110'],
  L: ['11000', '11000', '11000', '11000', '11000', '11000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

/**
 * Generates an SVG element for the authentic pixel art title "AVENTURA DAS LETRAS".
 * Uses the exact font matrix from the original game.
 */
export function createPixelLogoSvg() {
  const pixel = 4; // base pixel grid size
  const rows = ['AVENTURA', 'DAS LETRAS'];
  const rowHeight = 9 * pixel;
  const totalHeight = 2 * rowHeight + pixel * 2;
  const maxChars = Math.max(...rows.map((r) => r.length));
  const totalWidth = (maxChars * 6 - 1) * pixel + pixel * 4;

  const outlineRects = [];
  const fillRects = [];

  rows.forEach((word, lineIndex) => {
    const wordWidth = (word.length * 6 - 1) * pixel;
    const originX = Math.floor((totalWidth - wordWidth) / 2);
    const originY = lineIndex * rowHeight + pixel;

    for (let i = 0; i < word.length; i += 1) {
      const char = word[i];
      const glyph = GLYPHS[char] || GLYPHS[' '];

      for (let y = 0; y < 7; y += 1) {
        for (let x = 0; x < 5; x += 1) {
          if (glyph[y][x] === '1') {
            const px = originX + (i * 6 + x) * pixel;
            const py = originY + y * pixel;

            // Thick dark outline and drop shadow for pixel-3D depth
            outlineRects.push(
              `<rect x="${px - 1}" y="${py - 1}" width="${pixel + 2}" height="${pixel + 2}" fill="#233d38"/>`,
              `<rect x="${px + pixel}" y="${py + pixel}" width="${pixel}" height="${pixel}" fill="#162925"/>`,
            );

            // Fill color with top-row highlight
            const isRow0 = lineIndex === 0;
            let fillColor;
            if (isRow0) {
              fillColor = y === 0 ? '#ffea9f' : '#ffd479';
            } else {
              fillColor = y === 0 ? '#ffffff' : '#fbf4df';
            }

            fillRects.push(
              `<rect x="${px}" y="${py}" width="${pixel}" height="${pixel}" fill="${fillColor}"/>`,
            );
          }
        }
      }
    }
  });

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" class="pixel-logo-svg" role="img" aria-label="Aventura das Letras">
      <g class="logo-outline">${outlineRects.join('')}</g>
      <g class="logo-fill">${fillRects.join('')}</g>
    </svg>
  `.trim();

  const container = document.createElement('div');
  container.className = 'pixel-logo-wrapper';
  container.innerHTML = svgString;
  return container.firstElementChild;
}
