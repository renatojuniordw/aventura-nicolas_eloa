/**
 * Pose art for the player character.
 *
 * Each pose PNG (see `content/characters.js`) is a grid of animation frames,
 * not a single image — `POSE_FRAMES` records the grid size measured for each
 * pose so `frameRect` can slice out one frame by index. `POSE_BY_STATE` maps a
 * player state to the asset key preloaded by the `AssetManager` (see
 * `scenes/boot-scene.js` for the preload).
 */

/** Grid layout (columns x rows) measured for each Nicolas Gomes pose sheet. */
export const POSE_FRAMES = Object.freeze({
  idle: { columns: 2, rows: 2 },
  walk: { columns: 4, rows: 2 },
  jump: { columns: 3, rows: 2 },
  celebrate: { columns: 2, rows: 2 },
});

/** Player state -> asset key within the character's `sprites` map. */
export const POSE_BY_STATE = Object.freeze({
  idle: 'idle',
  walk: 'walk',
  jump: 'jump',
  fall: 'jump',
});

/** Source rect of one frame in a pose sheet, given its measured grid. */
export function frameRect(image, { columns, rows }, frameIndex) {
  const sw = image.width / columns;
  const sh = image.height / rows;
  const frame = frameIndex % (columns * rows);
  const column = frame % columns;
  const row = Math.floor(frame / columns);
  return { sx: column * sw, sy: row * sh, sw, sh };
}
