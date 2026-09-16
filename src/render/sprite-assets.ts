/**
 * Asset knowledge for the sprite renderer: background key resolution and
 * exact visual bounds for trimmed pixel art assets (no empty transparent
 * margins). Data only — no drawing — so asset mapping evolves here without
 * touching `SpriteRenderer`.
 */

// Exact visual bounds for trimmed pixel art assets.
export const LETTER_CARRIER_BOUNDS = Object.freeze({ sx: 257, sy: 279, sw: 740, sh: 718 });
export const CHECKPOINT_BOUNDS = Object.freeze({ sx: 334, sy: 116, sw: 636, sh: 1056 });
export const FINISH_PORTAL_BOUNDS = Object.freeze({ sx: 175, sy: 58, sw: 902, sh: 1135 });

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
