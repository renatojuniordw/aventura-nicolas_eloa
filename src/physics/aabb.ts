/**
 * Axis-Aligned Bounding Box helpers. Pure geometry, no DOM, no game rules.
 *
 * A box is a plain object `{ x, y, w, h }` in world pixels (y grows downward).
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function createBox(x: number, y: number, w: number, h: number): Box {
  return { x, y, w, h };
}

/** Standard AABB overlap test (touching edges do NOT count as overlap). */
export function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function containsPoint(box: Box, x: number, y: number): boolean {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

export function centerOf(box: Box): { x: number; y: number } {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/** Rectangle a point/box must stay inside (used for level bounds). */
export function boundsOf(boxes: Box[]): Box {
  if (boxes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
