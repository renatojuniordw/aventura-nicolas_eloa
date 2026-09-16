/**
 * Minimal publish/subscribe bus (Observer pattern).
 *
 * It is the only channel for cross-layer notifications: the game scene never
 * imports the HUD, the confetti or the progress store — they subscribe to
 * events. This keeps modules decoupled and individually testable.
 */

/** Canonical event names. Import these constants instead of raw strings. */
export const Events = Object.freeze({
  SCENE_CHANGED: 'scene.changed',
  APP_BLURRED: 'app.blurred',
  APP_FOCUSED: 'app.focused',
  LESSON_STARTED: 'lesson.started',
  ITEM_COLLECTED: 'item.collected',
  ANSWER_CORRECT: 'answer.correct',
  ANSWER_WRONG: 'answer.wrong',
  LIVES_CHANGED: 'lives.changed',
  LIVES_DEPLETED: 'lives.depleted',
  PLAYER_FELL: 'player.fell',
  HAZARD_HIT: 'hazard.hit',
  LEVEL_COMPLETE: 'level.complete',
  CELEBRATION: 'celebration.trigger',
  HUD_REFRESH: 'hud.refresh',
  PROGRESS_SAVED: 'progress.saved',
});

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._handlers = new Map();
  }

  /**
   * Subscribe to an event.
   * @returns {() => void} unsubscribe function
   */
  on(event, handler) {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    this._handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /** Subscribe for a single emission. */
  once(event, handler) {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  off(event, handler) {
    const handlers = this._handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /** Emit an event to all current subscribers. */
  emit(event, payload) {
    const handlers = this._handlers.get(event);
    if (!handlers) return;
    // Copy so handlers may unsubscribe during dispatch without skipping others.
    for (const handler of [...handlers]) {
      handler(payload);
    }
  }

  /** Remove every handler (used when tearing a scene down). */
  clear() {
    this._handlers.clear();
  }
}
