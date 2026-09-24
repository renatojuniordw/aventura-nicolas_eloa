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
  PORTAL_ENTERED: 'portal.entered',
  LEVEL_COMPLETE: 'level.complete',
  CELEBRATION: 'celebration.trigger',
  HUD_REFRESH: 'hud.refresh',
  PROGRESS_SAVED: 'progress.saved',
});

export type EventName = (typeof Events)[keyof typeof Events];

/**
 * Payload shape per event. Some payloads are still `unknown` because the
 * modules that emit them (lesson/item/hazard shapes) haven't been typed yet
 * — tighten these as their producing layers convert to TS.
 */
export interface EventPayloadMap {
  [Events.SCENE_CHANGED]: { name: string };
  [Events.APP_BLURRED]: undefined;
  [Events.APP_FOCUSED]: undefined;
  [Events.LESSON_STARTED]: { lesson: unknown };
  [Events.ITEM_COLLECTED]: { item: unknown };
  [Events.ANSWER_CORRECT]: unknown;
  [Events.ANSWER_WRONG]: unknown;
  [Events.LIVES_CHANGED]: { lives: number; maxLives: number };
  [Events.LIVES_DEPLETED]: Record<string, never>;
  [Events.PLAYER_FELL]: Record<string, never>;
  [Events.HAZARD_HIT]: { hazard: unknown };
  [Events.PORTAL_ENTERED]: Record<string, never>;
  [Events.LEVEL_COMPLETE]: unknown;
  [Events.CELEBRATION]: unknown;
  [Events.HUD_REFRESH]: unknown;
  [Events.PROGRESS_SAVED]: { profileId: unknown; lessonId: unknown; entry: unknown };
}

type Handler<E extends EventName> = (payload: EventPayloadMap[E]) => void;

export class EventBus {
  private _handlers = new Map<EventName, Set<Handler<any>>>();

  /**
   * Subscribe to an event.
   * @returns unsubscribe function
   */
  on<E extends EventName>(event: E, handler: Handler<E>): () => void {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    this._handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  /** Subscribe for a single emission. */
  once<E extends EventName>(event: E, handler: Handler<E>): () => void {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  off<E extends EventName>(event: E, handler: Handler<E>): void {
    const handlers = this._handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /** Emit an event to all current subscribers. */
  emit<E extends EventName>(event: E, payload?: EventPayloadMap[E]): void {
    const handlers = this._handlers.get(event);
    if (!handlers) return;
    // Copy so handlers may unsubscribe during dispatch without skipping others.
    for (const handler of [...handlers]) {
      handler(payload as EventPayloadMap[E]);
    }
  }

  /** Remove every handler (used when tearing a scene down). */
  clear(): void {
    this._handlers.clear();
  }
}
