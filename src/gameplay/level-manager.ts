import { overlap, type Box } from '../physics/aabb.js';
import { Events, type EventBus } from '../core/event-bus.js';
import type { Body } from '../physics/physics-engine.js';

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
  [key: string]: unknown;
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

  get remainingItems(): number {
    return this.level.items.length - this.collected.size;
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
  }

  /** Clears transient state after a respawn (collection stays!). */
  resetTransientState(): void {
    this._touchingHazards.clear();
    this._fellReported = false;
  }

  private _checkItems(body: Body): void {
    for (const item of this.level.items) {
      if (this.collected.has(item.id)) continue;
      if (overlap(body, item)) {
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
