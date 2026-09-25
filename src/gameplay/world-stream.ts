import { getLevelData } from '../content/level-registry.js';
import { loadLevel } from '../content/level-loader.js';
import { normalize } from '../content/text-utils.js';
import { PORTAL_SIZE } from '../core/config.js';
import type { Box } from '../physics/aabb.js';
import {
  TEMPLATE_IDS,
  SEGMENT_WIDTH,
  CANDIDATE_SPOTS,
  isSafeFromHazards,
  isTapReachable,
  shuffle,
  type Spot,
} from './speedrun-course.js';

export { PORTAL_SIZE };

const ITEM_SIZE = 32;
const SEGMENT_START_X = 96;
const SEGMENT_START_Y = 406;
const DISTRACTORS_PER_SEGMENT = 3;
/** Spots per segment never taken by distractors, so a target can always be (re)placed. */
const FREE_SPOTS_PER_SEGMENT = 2;
/** Segments kept generated ahead of the player. */
const LOOKAHEAD_SEGMENTS = 2;
/**
 * Whole segments kept behind the player's segment. Anything older is dropped
 * and a wall closes the world there, so memory stays bounded however long the
 * run lasts. Two segments (~3800px) is far more than anyone backtracks for.
 */
export const KEEP_BEHIND_SEGMENTS = 2;
/** The wall that closes the world where old segments were dropped. */
const BOUNDARY_WALL_WIDTH = 32;
const BOUNDARY_WALL_TOP = -2000;
/** A live target this far behind the player is off-screen and gets re-offered ahead. */
const TARGET_LEFT_BEHIND = 560;
/** Minimum distance ahead of the player when a target is (re)placed, so it never pops in on screen. */
const RESPAWN_MIN_AHEAD = 900;
const FIRST_TARGET_MIN_AHEAD = 250;
/** The letter is re-offered among the nearest few free spots ahead, picked at random. */
const RESPAWN_SPOT_CHOICES = 4;
const MAX_PLACEMENT_EXTENSIONS = 4;
/** The world is cut this far ahead of the player: inside the visible ~620px, so the portal shows up at once. */
const PORTAL_CUT_AHEAD = 420;
/** Never cut closer than this, so the portal does not appear on top of the player. */
const PORTAL_CUT_MIN_AHEAD = 160;
/** Room kept between the portal's right edge and the screen edge. */
const PORTAL_SCREEN_MARGIN = 24;
/** Flat arrival ground laid after the cut, and where the portal stands on it. */
const ARRIVAL_GROUND_WIDTH = 1200;
const PORTAL_OFFSET_IN_ARRIVAL = 40;
/** Respawn point on the arrival ground, past the cut. */
const ARRIVAL_RESPAWN_OFFSET = 8;
const PORTAL_APPEAR_SECONDS = 0.6;
const VIEWPORT_WIDTH = 960;

/** Ground row the portal stands on (world height 540 minus the 92px ground band). */
const PORTAL_FLOOR_Y = 448;

interface RawTemplateLevel {
  worldHeight: number;
  solids: Box[];
  oneWayPlatforms: Box[];
  hazards: (Box & { id: string })[];
}

export interface StreamItem extends Box {
  id: string;
  kind: string;
  type: 'target' | 'distractor';
  label: string;
}

interface Segment {
  index: number;
  xOffset: number;
  spots: Spot[]; // world-space, sorted left to right
}

/** The mutable world the stream grows. Same shape `LevelManager`, physics and the renderer read. */
export interface StreamLevel {
  schemaVersion: number;
  id: string;
  name: string;
  tileset: string;
  viewport: { width: number; height: number };
  tileSize: number;
  background: string;
  music: null;
  playerStart: Spot;
  checkpoint: Spot;
  /** `minX` follows the dropped-segment wall so the camera never shows the void behind it. */
  camera: { startX: number; minX: number; maxX: number; smoothing: number };
  physics: Record<string, never>;
  solids: Box[];
  oneWayPlatforms: Box[];
  items: StreamItem[];
  hazards: (Box & { id: string })[];
  decorations: never[];
  worldWidth: number;
  worldHeight: number;
  /** Set once the portal exists. */
  finish?: Spot;
  /** False until `spawnPortal`; the renderer and `LevelManager` ignore the portal until then. */
  portalActive: boolean;
  /** 0 -> 1 while the portal grows into view. */
  portalReveal: number;
}

export interface WorldStreamOptions {
  id: string;
  name: string;
  /** The label the player must collect first. */
  target: string;
  /** Item kind: 'letter' | 'word' | 'syllable'. */
  kind?: string;
  /** Labels that may be scattered as distractors while `target` is current. */
  distractorPool: (target: string) => string[];
  /** Distractors per regular segment (the start meadow always gets fewer). */
  distractorsPerSegment?: number;
  random?: () => number;
}

export interface SpawnPortalOptions {
  /** World x of the camera's right edge; the portal is kept fully inside it. */
  visibleRight?: number;
}

/**
 * An endless side-scrolling world. Terrain is stitched on demand from the same
 * stage templates the fixed courses use, always a couple of screens ahead of
 * the player, and dropped a couple of screens behind, so the world held in
 * memory stays the same size however long the run lasts.
 *
 * Invariants it keeps:
 * - While unsealed there is exactly one target in the world (re-offered ahead
 *   when left behind, or when a placement ever failed).
 * - No distractor is a label the current target's pool forbids: when the
 *   target changes, now-incompatible distractors are withdrawn (and reported
 *   through `drainWithdrawn` so the scene can pop them visibly).
 * - Once the last target has been collected `spawnPortal` seals the world with
 *   an arrival stretch and a portal; it is idempotent.
 *
 * Pure world state: it never decides what a collected item means (that is the
 * scene's validator) or draws anything.
 */
export class WorldStream {
  readonly level: StreamLevel;
  /** Bumped whenever terrain changes, so the renderer knows to refresh its cached surfaces. */
  terrainVersion = 0;

  private _templates: RawTemplateLevel[];
  private _random: () => number;
  private _distractorPool: (target: string) => string[];
  private _distractorsPerSegment: number;
  private _kind: string;
  private _segments: Segment[] = [];
  private _nextSegmentIndex = 0;
  private _target: string;
  private _lastTemplate = -1;
  private _sealed = false;
  /** Where the arrival ground starts once sealed. */
  private _cutX = Number.POSITIVE_INFINITY;
  private _itemSeq = 0;
  private _playerX = SEGMENT_START_X;
  private _withdrawn: StreamItem[] = [];

  constructor({
    id,
    name,
    target,
    kind = 'letter',
    distractorPool,
    distractorsPerSegment = DISTRACTORS_PER_SEGMENT,
    random = Math.random,
  }: WorldStreamOptions) {
    this._templates = TEMPLATE_IDS.map((templateId) => {
      const raw = getLevelData(templateId);
      if (!raw) throw new Error(`Missing template level data: ${templateId}`);
      return loadLevel(raw) as unknown as RawTemplateLevel;
    });
    this._random = random;
    this._distractorPool = distractorPool;
    this._distractorsPerSegment = distractorsPerSegment;
    this._kind = kind;
    this._target = target;

    this.level = {
      schemaVersion: 1,
      id,
      name,
      tileset: 'placeholder',
      viewport: { width: VIEWPORT_WIDTH, height: 540 },
      tileSize: 32,
      background: 'bg:primavera-lago',
      music: null,
      playerStart: { x: SEGMENT_START_X, y: SEGMENT_START_Y },
      checkpoint: { x: SEGMENT_START_X, y: SEGMENT_START_Y },
      // Unbounded to the right until the portal fixes the end of the world.
      camera: { startX: 0, minX: 0, maxX: Number.POSITIVE_INFINITY, smoothing: 0.12 },
      physics: {},
      solids: [],
      oneWayPlatforms: [],
      items: [],
      hazards: [],
      decorations: [],
      worldWidth: 0,
      worldHeight: this._templates[0].worldHeight,
      portalActive: false,
      portalReveal: 0,
    };

    this._extendTo(SEGMENT_START_X + (LOOKAHEAD_SEGMENTS + 1) * SEGMENT_WIDTH);
    this._spawnTarget(FIRST_TARGET_MIN_AHEAD);
  }

  get target(): string {
    return this._target;
  }

  get sealed(): boolean {
    return this._sealed;
  }

  /** Number of segments currently held in memory (bounded by the window). */
  get segmentCount(): number {
    return this._segments.length;
  }

  /** The live target item, if one is currently in the world. */
  get liveTarget(): StreamItem | undefined {
    return this.level.items.find((item) => item.type === 'target');
  }

  /**
   * Where the player respawns: the start of the segment they are in. Once
   * sealed, anyone on the arrival ground respawns at its start, since the
   * segment grid no longer describes the terrain past the cut.
   */
  checkpointFor(playerX: number): Spot {
    if (this._sealed && playerX >= this._cutX) {
      return { x: this._cutX + ARRIVAL_RESPAWN_OFFSET, y: SEGMENT_START_Y };
    }
    const index = Math.max(0, Math.floor(playerX / SEGMENT_WIDTH));
    return { x: index * SEGMENT_WIDTH + SEGMENT_START_X, y: SEGMENT_START_Y };
  }

  /**
   * The player (now at `playerX`) needs `label`: withdraw the old target,
   * withdraw distractors the new target's pool forbids, and offer the new one ahead.
   */
  setTarget(label: string, playerX = this._playerX): void {
    this._playerX = playerX;
    this._target = label;
    this._removeTargets();
    if (this._sealed) return;
    this._withdrawIncompatibleDistractors();
    this._spawnTarget(RESPAWN_MIN_AHEAD);
  }

  /** Items withdrawn from the world since the last call (so the scene can pop the visible ones). */
  drainWithdrawn(): StreamItem[] {
    const withdrawn = this._withdrawn;
    this._withdrawn = [];
    return withdrawn;
  }

  /** Keeps the world generated ahead of the player, trims it behind, and keeps a target on offer. */
  update(playerX: number): void {
    this._playerX = playerX;
    if (this._sealed) return;
    this._extendTo(playerX + LOOKAHEAD_SEGMENTS * SEGMENT_WIDTH);
    this._trimBehind(playerX);
    const live = this.liveTarget;
    if (!live) {
      // A previous placement found no room (or the target was dropped): offer it again.
      this._spawnTarget(RESPAWN_MIN_AHEAD);
    } else if (live.x < playerX - TARGET_LEFT_BEHIND) {
      this._removeTargets();
      this._spawnTarget(RESPAWN_MIN_AHEAD);
    }
  }

  /** Advances the portal's grow-in animation. */
  tick(dt: number): void {
    if (this.level.portalActive && this.level.portalReveal < 1) {
      this.level.portalReveal = Math.min(1, this.level.portalReveal + dt / PORTAL_APPEAR_SECONDS);
    }
  }

  /**
   * Seals the world: withdraws every remaining letter (the objective is done),
   * cuts everything generated beyond the screen ahead and lays flat arrival
   * ground with the portal on it. Returns the portal's position; calling it
   * again returns the same portal.
   */
  spawnPortal(playerX: number, { visibleRight }: SpawnPortalOptions = {}): Spot {
    const level = this.level;
    if (this._sealed && level.finish) return level.finish;
    this._sealed = true;

    let cutX = playerX + PORTAL_CUT_AHEAD;
    if (visibleRight !== undefined) {
      cutX = Math.min(cutX, visibleRight - PORTAL_SCREEN_MARGIN - PORTAL_SIZE.w - PORTAL_OFFSET_IN_ARRIVAL);
    }
    cutX = Math.round(Math.max(cutX, playerX + PORTAL_CUT_MIN_AHEAD));
    this._cutX = cutX;

    const clip = (boxes: Box[]): Box[] =>
      boxes
        .filter((box) => box.x < cutX)
        .map((box) => (box.x + box.w > cutX ? { ...box, w: cutX - box.x } : box));
    // One 32px row at a time, like the templates' own ground, so the terrain looks the same on both sides of the cut.
    const arrivalGround: Box[] = [];
    for (let y = PORTAL_FLOOR_Y; y < level.worldHeight; y += level.tileSize) {
      arrivalGround.push({ x: cutX, y, w: ARRIVAL_GROUND_WIDTH, h: level.tileSize });
    }
    level.solids = [...clip(level.solids), ...arrivalGround];
    level.oneWayPlatforms = clip(level.oneWayPlatforms);
    level.hazards = level.hazards.filter((hazard) => hazard.x + hazard.w < cutX);
    // No letter is left to answer once the objective is done: nothing can cost a heart on the way to the portal.
    this._withdrawn.push(...level.items);
    level.items = [];
    level.worldWidth = cutX + ARRIVAL_GROUND_WIDTH;

    const finish = { x: cutX + PORTAL_OFFSET_IN_ARRIVAL, y: PORTAL_FLOOR_Y - PORTAL_SIZE.h };
    level.finish = finish;
    level.portalActive = true;
    level.portalReveal = 0;
    level.camera.maxX = Math.max(level.camera.minX, level.worldWidth - VIEWPORT_WIDTH);
    this.terrainVersion += 1;
    return finish;
  }

  // --- Generation -----------------------------------------------------------

  private _extendTo(worldX: number): void {
    while (this.level.worldWidth < worldX) {
      const index = this._nextSegmentIndex;
      this._nextSegmentIndex += 1;
      this._appendSegment(index, this._pickTemplate(index));
    }
  }

  private _pickTemplate(index: number): number {
    // The first segment is the start meadow: always the safest one.
    if (index === 0) return 0;
    const choices = this._templates.map((_, i) => i).filter((i) => i !== this._lastTemplate);
    return choices[Math.floor(this._random() * choices.length)];
  }

  private _appendSegment(index: number, templateIndex: number): void {
    const template = this._templates[templateIndex];
    const xOffset = index * SEGMENT_WIDTH;
    this._lastTemplate = templateIndex;
    const level = this.level;

    level.solids = [
      ...level.solids,
      ...template.solids.map((s) => ({ x: s.x + xOffset, y: s.y, w: s.w, h: s.h })),
    ];
    level.oneWayPlatforms = [
      ...level.oneWayPlatforms,
      ...template.oneWayPlatforms.map((p) => ({ x: p.x + xOffset, y: p.y, w: p.w, h: p.h })),
    ];
    level.hazards = [
      ...level.hazards,
      ...template.hazards.map((h) => ({
        id: `hazard-${index}-${h.id}`,
        x: h.x + xOffset,
        y: h.y,
        w: h.w,
        h: h.h,
      })),
    ];

    const segment: Segment = { index, xOffset, spots: templateSpots(templateIndex, template, xOffset) };
    this._segments.push(segment);
    level.worldWidth = (index + 1) * SEGMENT_WIDTH;
    this.terrainVersion += 1;

    this._scatterDistractors(segment);
  }

  /**
   * Drops whole segments more than `KEEP_BEHIND_SEGMENTS` behind the player,
   * and closes the world with a wall where they were.
   */
  private _trimBehind(playerX: number): void {
    const keepFrom = Math.floor(playerX / SEGMENT_WIDTH) - KEEP_BEHIND_SEGMENTS;
    const oldest = this._segments[0];
    if (keepFrom <= 0 || !oldest || oldest.index >= keepFrom) return;

    const level = this.level;
    const dropX = keepFrom * SEGMENT_WIDTH;
    const kept = (box: Box) => box.x >= dropX;
    const wall: Box = {
      x: dropX - BOUNDARY_WALL_WIDTH,
      y: BOUNDARY_WALL_TOP,
      w: BOUNDARY_WALL_WIDTH,
      h: level.worldHeight - BOUNDARY_WALL_TOP,
    };
    level.solids = [wall, ...level.solids.filter(kept)];
    level.oneWayPlatforms = level.oneWayPlatforms.filter(kept);
    level.hazards = level.hazards.filter(kept);
    level.items = level.items.filter(kept);
    level.camera.minX = dropX;
    this._segments = this._segments.filter((segment) => segment.index >= keepFrom);
    this.terrainVersion += 1;
  }

  /** A few distractor letters per segment; the remaining spots stay free for the target. */
  private _scatterDistractors(segment: Segment): void {
    const pool = this._distractorPool(this._target);
    if (pool.length === 0) return;
    // Keep the start meadow calm: fewer distractors right where the player spawns.
    const wanted = segment.index === 0 ? 2 : this._distractorsPerSegment;
    // Some templates have only 2-4 usable spots: always leave a couple free for the target.
    const count = Math.max(0, Math.min(wanted, segment.spots.length - FREE_SPOTS_PER_SEGMENT));
    const spots = shuffle(segment.spots, this._random)
      .filter((spot) => spot.x - segment.xOffset > 200)
      .slice(0, count);
    const labels = shuffle(pool, this._random);
    const added = spots.map((spot, i) => this._makeItem('distractor', labels[i % labels.length], spot));
    if (added.length > 0) this.level.items = [...this.level.items, ...added];
  }

  // --- Target management ----------------------------------------------------

  private _spawnTarget(minAhead: number): void {
    const from = this._playerX + minAhead;
    let free: Spot[] = [];
    // Enough terrain must exist to hold a free spot at least `minAhead` away; grow until it does.
    for (let attempt = 0; attempt <= MAX_PLACEMENT_EXTENSIONS && free.length === 0; attempt += 1) {
      this._extendTo(from + (LOOKAHEAD_SEGMENTS + attempt) * SEGMENT_WIDTH);
      free = this._spotsFrom(from).filter((spot) => !this._isOccupied(spot));
    }
    if (free.length > 0) {
      const spot = free[Math.floor(this._random() * Math.min(RESPAWN_SPOT_CHOICES, free.length))];
      this._placeTarget(spot);
      return;
    }

    // Every spot ahead is taken: give the nearest one to the target, withdrawing
    // the distractors on it (they are off-screen, `minAhead` away). If no spot
    // exists at all, `update` retries on the next frame.
    const spot = this._spotsFrom(from)[0];
    if (!spot) return;
    const blocking = this.level.items.filter((item) => isNear(item, spot));
    this._withdraw(blocking);
    this._placeTarget(spot);
  }

  private _spotsFrom(from: number): Spot[] {
    return this._segments
      .flatMap((segment) => segment.spots)
      .filter((spot) => spot.x >= from)
      .sort((a, b) => a.x - b.x);
  }

  private _placeTarget(spot: Spot): void {
    this.level.items = [...this.level.items, this._makeItem('target', this._target, spot)];
  }

  private _removeTargets(): void {
    if (this.level.items.some((item) => item.type === 'target')) {
      this.level.items = this.level.items.filter((item) => item.type !== 'target');
    }
  }

  /** Distractors scattered for an earlier target that the current one's pool forbids (e.g. the new answer itself). */
  private _withdrawIncompatibleDistractors(): void {
    const allowed = new Set(this._distractorPool(this._target).map(normalize));
    const answer = normalize(this._target);
    this._withdraw(
      this.level.items.filter(
        (item) => item.type === 'distractor' && (!allowed.has(normalize(item.label)) || normalize(item.label) === answer),
      ),
    );
  }

  private _withdraw(items: StreamItem[]): void {
    if (items.length === 0) return;
    const gone = new Set(items);
    this.level.items = this.level.items.filter((item) => !gone.has(item));
    this._withdrawn.push(...items);
  }

  private _isOccupied(spot: Spot): boolean {
    return this.level.items.some((item) => isNear(item, spot));
  }

  private _makeItem(type: 'target' | 'distractor', label: string, spot: Spot): StreamItem {
    this._itemSeq += 1;
    return {
      id: `stream-item-${this._itemSeq}-${type}`,
      kind: this._kind,
      type,
      label,
      x: Math.round(spot.x),
      y: Math.round(spot.y),
      w: ITEM_SIZE,
      h: ITEM_SIZE,
    };
  }
}

function isNear(item: Spot, spot: Spot): boolean {
  return Math.abs(item.x - spot.x) < ITEM_SIZE * 2 && Math.abs(item.y - spot.y) < ITEM_SIZE * 2;
}

/**
 * Where letters may sit in one template, in world space: its candidate spots,
 * preferring ones clear of hazards and reachable with a quick tap. Exported
 * for tests that check the preferred spots are never empty.
 */
export function templateSpots(templateIndex: number, template: RawTemplateLevel, xOffset = 0): Spot[] {
  const rawSpots = CANDIDATE_SPOTS[templateIndex];
  const safeSpots = rawSpots.filter((s) => isSafeFromHazards(s.x, ITEM_SIZE, template.hazards));
  const spotCandidates = safeSpots.length >= 4 ? safeSpots : rawSpots;
  const supports = [...template.solids, ...template.oneWayPlatforms];
  const reachable = spotCandidates.filter((s) => isTapReachable(s, supports));
  return (reachable.length > 0 ? reachable : spotCandidates)
    .map((s) => ({ x: s.x + xOffset, y: s.y }))
    .sort((a, b) => a.x - b.x);
}
