import { overlap } from '../physics/aabb.js';
import { Events } from '../core/event-bus.js';

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
  constructor({ level, bus = null }) {
    this.level = level;
    this._bus = bus;
    /** @type {Set<string>} ids of items already collected */
    this.collected = new Set();
    this._touchingHazards = new Set();
    this._fellReported = false;
  }

  get targetCollected() {
    return this.level.items.some(
      (item) => item.type === 'target' && this.collected.has(item.id),
    );
  }

  get remainingItems() {
    return this.level.items.length - this.collected.size;
  }

  getRespawnPoint() {
    return this.level.checkpoint;
  }

  /** @param {{ body: {x:number,y:number,w:number,h:number} }} player */
  update(player) {
    this._checkItems(player.body);
    this._checkHazards(player.body);
    this._checkFall(player.body);
  }

  /** Clears transient state after a respawn (collection stays!). */
  resetTransientState() {
    this._touchingHazards.clear();
    this._fellReported = false;
  }

  _checkItems(body) {
    for (const item of this.level.items) {
      if (this.collected.has(item.id)) continue;
      if (overlap(body, item)) {
        this.collected.add(item.id);
        this._bus?.emit(Events.ITEM_COLLECTED, { item });
      }
    }
  }

  _checkHazards(body) {
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

  _checkFall(body) {
    const fell = body.y > this.level.worldHeight;
    if (fell && !this._fellReported) {
      this._fellReported = true;
      this._bus?.emit(Events.PLAYER_FELL, {});
    } else if (!fell) {
      this._fellReported = false;
    }
  }
}
