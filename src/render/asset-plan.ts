import { POSE_BY_STATE } from '../content/atlas-meta.js';
import type { Character } from '../content/characters.js';
import { resolveBackgroundKey } from './sprite-assets.js';

/**
 * Which art the renderer needs, and when. Data only: the boot scene preloads
 * the small always-needed set, and each lesson asks for its own background and
 * the active character's poses right before it starts — so a session only
 * downloads and decodes the art it actually draws.
 */

/** Panoramic backgrounds, keyed the way `resolveBackgroundKey` names them. */
export const BACKGROUND_ASSETS: Readonly<Record<string, string>> = Object.freeze({
  'bg:primavera-lago': '/assets/backgrounds/primavera-lago-pixel-v1.webp',
  'bg:primavera-pomar': '/assets/backgrounds/primavera-pomar-pixel-v1.webp',
  'bg:outono-bosque': '/assets/backgrounds/outono-bosque-pixel-v1.webp',
  'bg:outono-vale': '/assets/backgrounds/outono-vale-pixel-v1.webp',
  'bg:garden-pixel': '/assets/backgrounds/garden-pixel-v1.webp',
});

/** Items and objects drawn in every level. */
export const WORLD_ASSETS: Readonly<Record<string, string>> = Object.freeze({
  'item:letter-carrier': '/assets/items/letter-carrier-pixel-v1.webp',
  'object:checkpoint': '/assets/objects/checkpoint-pixel-v1.webp',
  'object:finish-portal': '/assets/objects/finish-portal-pixel-v1.webp',
});

const GAMEPLAY_POSES = new Set<string>(Object.values(POSE_BY_STATE));

/**
 * The character's in-game pose sheets. Portraits and the celebrate sheet are
 * shown by DOM screens straight from their URL, so the canvas never needs them.
 */
export function characterAssets(character: Pick<Character, 'id' | 'sprites'>): Record<string, string> {
  const assets: Record<string, string> = {};
  for (const [pose, src] of Object.entries(character.sprites ?? {})) {
    if (GAMEPLAY_POSES.has(pose)) assets[`${character.id}:${pose}`] = src;
  }
  return assets;
}

/** Everything a lesson draws that is not already part of the boot preload. */
export function lessonAssets(
  level: { id?: string; background?: string } | null,
  character: Pick<Character, 'id' | 'sprites'>,
): Record<string, string> {
  const backgroundKey = resolveBackgroundKey(level);
  const background = BACKGROUND_ASSETS[backgroundKey];
  return {
    ...(background ? { [backgroundKey]: background } : {}),
    ...characterAssets(character),
  };
}
