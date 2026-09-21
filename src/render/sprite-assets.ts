/**
 * Asset knowledge for the sprite renderer: background key resolution and
 * exact visual bounds for trimmed pixel art assets (no empty transparent
 * margins). Data only — no drawing — so asset mapping evolves here without
 * touching `SpriteRenderer`.
 */

// Exact visual bounds for trimmed pixel art assets, in the pixels of the
// shipped 504x504 sheets (the 1254x1254 originals scaled by 504/1254, edges
// rounded outward so no art is clipped).
export const LETTER_CARRIER_BOUNDS = Object.freeze({ sx: 103, sy: 112, sw: 298, sh: 289 });
export const CHECKPOINT_BOUNDS = Object.freeze({ sx: 134, sy: 46, sw: 256, sh: 426 });
export const FINISH_PORTAL_BOUNDS = Object.freeze({ sx: 70, sy: 23, sw: 363, sh: 457 });

/** On-screen size of the finish portal, in world pixels. */
export const FINISH_PORTAL_SIZE = Object.freeze({ w: 86, h: 84 });

/** Portal distance from the world's right edge, and from its floor (the ground row). */
const FINISH_PORTAL_RIGHT_MARGIN = 130;
const FINISH_PORTAL_FLOOR_MARGIN = 92;

/**
 * Where the finish portal stands: a level file may place it with an explicit
 * `finish: { x, y }`, otherwise it sits on the ground near the world's right edge.
 */
export function finishPortalPosition(level: {
  finish?: { x: number; y: number };
  worldWidth?: number;
  worldHeight?: number;
}): { x: number; y: number } {
  if (level.finish) return { x: level.finish.x, y: level.finish.y };
  return {
    x: (level.worldWidth ?? 1920) - FINISH_PORTAL_RIGHT_MARGIN,
    y: (level.worldHeight ?? 540) - FINISH_PORTAL_FLOOR_MARGIN - FINISH_PORTAL_SIZE.h,
  };
}

/**
 * Resolves the panoramic background asset key for a level, from an explicit
 * `bg:` key, a filename hint, or the level category.
 */
export function resolveBackgroundKey(level: { id?: string; background?: string } | null): string {
  if (!level) return 'bg:primavera-lago';
  if (level.background && typeof level.background === 'string') {
    if (level.background.startsWith('bg:')) return level.background;
    if (level.background.includes('pomar')) return 'bg:primavera-pomar';
    if (level.background.includes('bosque')) return 'bg:outono-bosque';
    if (level.background.includes('vale')) return 'bg:outono-vale';
    if (level.background.includes('garden')) return 'bg:garden-pixel';
  }

  // Pick themed background by level category
  const id = level.id ?? '';
  if (id.includes('palavras') || id.includes('dificil')) return 'bg:outono-bosque';
  if (id.includes('silabas')) return 'bg:primavera-pomar';
  if (id.includes('encontros')) return 'bg:outono-vale';
  return 'bg:primavera-lago';
}
