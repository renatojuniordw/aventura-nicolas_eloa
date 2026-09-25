import { overlap, type Box } from '../physics/aabb.js';
import { GAMEPLAY, PORTAL_SIZE } from '../core/config.js';
import { Events, type EventBus } from '../core/event-bus.js';
import type { Body } from '../physics/physics-engine.js';

function inflate(box: Box, margin: number): Box {
  return { x: box.x - margin, y: box.y - margin, w: box.w + margin * 2, h: box.h + margin * 2 };
}

export interface Point {
  x: number;
  y: number;
}

export interface LevelItem extends Box {
  id: string;
  type: string;
  label: string;
}

export interface LevelHazard extends Box {
  id: string;
}

/** Shape produced by `content/level-loader.js`'s `loadLevel`. */
export interface Level {
  id: string;
  items: LevelItem[];
  hazards: LevelHazard[];
  solids: Box[];
  oneWayPlatforms: Box[];
  worldHeight: number;
  checkpoint: Point;
  /** Portal position; only meaningful once `portalActive` is true. */
  finish?: Point;
  portalActive?: boolean;
  /** 0 -> 1 while the portal grows in; the portal only takes the player once it is complete. */
  portalReveal?: number;
}

interface LevelManagerOptions {
  level: Level;
  bus?: EventBus | null;
}

/**
 * Tracks what is happening *inside* a level: which items were collected, when
 * the player enters a hazard and when the player falls out of the world.
 *
 * It reports facts through the event bus and never decides what they mean —
 * whether a collected item was the right answer is the AnswerValidator's job,
 * and losing a heart is the LivesManager's. That separation keeps each rule in
 * exactly one place.
 */
export class LevelManager {
  level: Level;
  /** ids of items already collected */
  collected = new Set<string>();
  currentCheckpoint: Point;

  private _bus: EventBus | null;
  private _touchingHazards = new Set<string>();
  private _fellReported = false;
  private _portalReported = false;

  constructor({ level, bus = null }: LevelManagerOptions) {
    this.level = level;
    this._bus = bus;
    /** Respawn point, tracked here so levels can stay frozen even as checkpoints advance. */
    this.currentCheckpoint = level.checkpoint;
  }

  get targetCollected(): boolean {
    return this.level.items.some(
      (item) => item.type === 'target' && this.collected.has(item.id),
    );
  }

  /** Items still in the world and not collected (a streamed world withdraws items, so count what is there). */
  get remainingItems(): number {
    return this.level.items.filter((item) => !this.collected.has(item.id)).length;
  }

  /** Forgets collected ids whose items have left the world, so the set stays bounded in an endless level. */
  pruneCollected(): void {
    if (this.collected.size === 0) return;
    const present = new Set(this.level.items.map((item) => item.id));
    for (const id of this.collected) {
      if (!present.has(id)) this.collected.delete(id);
    }
  }

  getRespawnPoint(): Point {
    return this.currentCheckpoint;
  }

  /** Advances the respawn point (e.g. speedrun segment progress) without mutating the level. */
  setCheckpoint(point: Point): void {
    this.currentCheckpoint = point;
  }

  update(player: { body: Body }): void {
    this._checkItems(player.body);
    this._checkHazards(player.body);
    this._checkFall(player.body);
    this._checkPortal(player.body);
  }

  /** Clears transient state after a respawn (collection stays!). */
  resetTransientState(): void {
    this._touchingHazards.clear();
    this._fellReported = false;
  }

  private _checkItems(body: Body): void {
    const items = this.level.items;
    for (const item of items) {
      if (this.collected.has(item.id)) continue;
      // A listener may have reshaped the world mid-loop (new target, portal):
      // an item withdrawn by that reaction must not be collected from the stale list.
      if (this.level.items !== items && !this.level.items.includes(item)) continue;
      if (overlap(body, inflate(item, GAMEPLAY.itemPickupMargin))) {
        this.collected.add(item.id);
        this._bus?.emit(Events.ITEM_COLLECTED, { item });
      }
    }
  }

  private _checkHazards(body: Body): void {
    for (const hazard of this.level.hazards) {
      const touching = overlap(body, hazard);
      if (touching && !this._touchingHazards.has(hazard.id)) {
        this._touchingHazards.add(hazard.id);
        this._bus?.emit(Events.HAZARD_HIT, { hazard });
      } else if (!touching) {
        this._touchingHazards.delete(hazard.id);
      }
    }
  }

  /** Reports the portal once, when the player steps into an active one. */
  private _checkPortal(body: Body): void {
    const { finish, portalActive } = this.level;
    if (!portalActive || !finish || this._portalReported) return;
    // Only a fully grown portal takes the player in, so drawing and collision always agree.
    if ((this.level.portalReveal ?? 1) < 1) return;
    if (overlap(body, { x: finish.x, y: finish.y, w: PORTAL_SIZE.w, h: PORTAL_SIZE.h })) {
      this._portalReported = true;
      this._bus?.emit(Events.PORTAL_ENTERED, {});
    }
  }

  private _checkFall(body: Body): void {
    const fell = body.y > this.level.worldHeight;
    if (fell && !this._fellReported) {
      this._fellReported = true;
      this._bus?.emit(Events.PLAYER_FELL, {});
    } else if (!fell) {
      this._fellReported = false;
    }
  }
}
