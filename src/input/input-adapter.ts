export interface ActionMeta {
  pressed: boolean;
  repeated: boolean;
}

export type OnAction = (action: string, meta: ActionMeta) => void;

/**
 * Strategy contract for input sources.
 *
 * An adapter's only job is to translate physical input into semantic actions
 * and hand them to the callback supplied by the InputManager. Adapters must
 * never import gameplay, physics or render modules — that keeps the input
 * layer replaceable (this is the seam where a future ESP32 adapter plugs in).
 *
 * Contract:
 *   - emit actions, never keys, never game state
 *   - call `onAction(actionId, { pressed, repeated })`
 *     · pressed: true on activation, false on release
 *     · repeated: true only for OS key-repeat (edge actions ignore it)
 */
export class InputAdapter {
  onAction: OnAction;

  constructor(onAction: OnAction) {
    if (typeof onAction !== 'function') {
      throw new TypeError('InputAdapter requires an onAction callback');
    }
    this.onAction = onAction;
  }

  /** Register hardware listeners. */
  attach(): void {}

  /** Unregister hardware listeners. */
  detach(): void {}

  /**
   * Re-assert any state this adapter owns without a physical source behind
   * it (e.g. AutoRunAdapter's continuous MOVE_RIGHT). Called by InputManager
   * after `reset()` clears held state for a reason unrelated to this
   * adapter's own input (pause/resume, tab blur) — a keyboard or touch
   * adapter needs no override here, since nothing is physically held after
   * a reset until the user acts again; an adapter with no hardware behind it
   * would otherwise stay silently "let go" forever.
   */
  resync(): void {}

  /** Release all resources. */
  dispose(): void {
    this.detach();
  }
}
