// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { TouchAdapter } from './touch-adapter.js';
import { Actions } from './actions.js';

function pointerEvent(type, pointerId = 1) {
  return new PointerEvent(type, { pointerId, bubbles: true, cancelable: true });
}

describe('TouchAdapter', () => {
  it('emits pressed:true on pointerdown and pressed:false on pointerup', () => {
    const button = document.createElement('button');
    const onAction = vi.fn();
    const adapter = new TouchAdapter(onAction, {
      buttons: [{ element: button, action: Actions.JUMP }],
    });
    adapter.attach();

    button.dispatchEvent(pointerEvent('pointerdown'));
    expect(onAction).toHaveBeenCalledWith(Actions.JUMP, { pressed: true, repeated: false });

    button.dispatchEvent(pointerEvent('pointerup'));
    expect(onAction).toHaveBeenCalledWith(Actions.JUMP, { pressed: false, repeated: false });
  });

  it('releases the action on pointercancel and pointerleave too', () => {
    const button = document.createElement('button');
    const onAction = vi.fn();
    const adapter = new TouchAdapter(onAction, {
      buttons: [{ element: button, action: Actions.MOVE_LEFT }],
    });
    adapter.attach();

    button.dispatchEvent(pointerEvent('pointerdown'));
    button.dispatchEvent(pointerEvent('pointercancel'));
    expect(onAction).toHaveBeenLastCalledWith(Actions.MOVE_LEFT, { pressed: false, repeated: false });

    button.dispatchEvent(pointerEvent('pointerdown'));
    button.dispatchEvent(pointerEvent('pointerleave'));
    expect(onAction).toHaveBeenLastCalledWith(Actions.MOVE_LEFT, { pressed: false, repeated: false });
  });

  it('routes each button to its own action', () => {
    const left = document.createElement('button');
    const right = document.createElement('button');
    const onAction = vi.fn();
    const adapter = new TouchAdapter(onAction, {
      buttons: [
        { element: left, action: Actions.MOVE_LEFT },
        { element: right, action: Actions.MOVE_RIGHT },
      ],
    });
    adapter.attach();

    right.dispatchEvent(pointerEvent('pointerdown'));
    expect(onAction).toHaveBeenCalledWith(Actions.MOVE_RIGHT, { pressed: true, repeated: false });
    expect(onAction).not.toHaveBeenCalledWith(Actions.MOVE_LEFT, expect.anything());
  });

  it('stops listening after detach', () => {
    const button = document.createElement('button');
    const onAction = vi.fn();
    const adapter = new TouchAdapter(onAction, {
      buttons: [{ element: button, action: Actions.JUMP }],
    });
    adapter.attach();
    adapter.detach();

    button.dispatchEvent(pointerEvent('pointerdown'));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('is idempotent: attaching twice does not double-fire actions', () => {
    const button = document.createElement('button');
    const onAction = vi.fn();
    const adapter = new TouchAdapter(onAction, {
      buttons: [{ element: button, action: Actions.JUMP }],
    });
    adapter.attach();
    adapter.attach();

    button.dispatchEvent(pointerEvent('pointerdown'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
