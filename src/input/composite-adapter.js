import { InputAdapter } from './input-adapter.js';

/**
 * Combines several adapters behind the single InputAdapter contract, so
 * InputManager still only ever knows about "one adapter" (Open/Closed: no
 * change needed there) while multiple physical sources stay live at once —
 * e.g. a touchscreen laptop where keyboard and on-screen buttons both work.
 *
 * Every child adapter was built with the same `onAction` callback, so this
 * class does no translation of its own: it only fans attach/detach out.
 */
export class CompositeAdapter extends InputAdapter {
  /**
   * @param {(action: string, meta: { pressed: boolean, repeated: boolean }) => void} onAction
   * @param {InputAdapter[]} adapters
   */
  constructor(onAction, adapters) {
    super(onAction);
    this._adapters = adapters;
  }

  attach() {
    for (const adapter of this._adapters) adapter.attach();
  }

  detach() {
    for (const adapter of this._adapters) adapter.detach();
  }

  dispose() {
    for (const adapter of this._adapters) adapter.dispose();
  }
}
