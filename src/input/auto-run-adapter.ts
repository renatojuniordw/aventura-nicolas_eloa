import { InputAdapter } from './input-adapter.js';
import { Actions } from './actions.js';

/**
 * Generates MOVE_RIGHT continuously, no hardware behind it — used in phone
 * mode (docs/12-controle-por-celular.md §9), where the only gesture the
 * child performs is the jump and the character otherwise walks on its own.
 *
 * Modeled as an adapter, not a special case in player-controller.ts or
 * game-scene.ts, so gameplay stays unaware of *why* MOVE_RIGHT is held.
 *
 * Must be the only source of MOVE_LEFT/MOVE_RIGHT while active: InputManager
 * tracks "held" as one boolean per action shared across every adapter (see
 * input-manager.ts), so a stray keyup from KeyboardAdapter/TouchAdapter
 * sharing the same CompositeAdapter could zero out the held state this
 * adapter relies on. main.ts's phone-control wiring keeps the two apart.
 */
export class AutoRunAdapter extends InputAdapter {
  override attach(): void {
    this.onAction(Actions.MOVE_RIGHT, { pressed: true, repeated: false });
  }

  override detach(): void {
    this.onAction(Actions.MOVE_RIGHT, { pressed: false, repeated: false });
  }

  /**
   * `InputManager.reset()` (pause/resume, tab blur — see game-scene.ts) wipes
   * held state for every adapter, including this one's MOVE_RIGHT, which has
   * no key or touch behind it to re-press it. Without this, resuming from
   * any pause left the character stopped for the rest of the session.
   */
  override resync(): void {
    this.attach();
  }
}
