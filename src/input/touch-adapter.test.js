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

  describe('multitouch', () => {
    function setup() {
      const left = document.createElement('button');
      const right = document.createElement('button');
      const jump = document.createElement('button');
      const onAction = vi.fn();
      const adapter = new TouchAdapter(onAction, {
        buttons: [
          { element: left, action: Actions.MOVE_LEFT },
          { element: right, action: Actions.MOVE_RIGHT },
          { element: jump, action: Actions.JUMP },
        ],
      });
      adapter.attach();
      const calls = (action) => onAction.mock.calls.filter(([a]) => a === action).map(([, meta]) => meta.pressed);
      return { left, right, jump, onAction, adapter, calls };
    }

    it('keeps moving while another finger taps jump repeatedly', () => {
      const { right, jump, calls } = setup();
      right.dispatchEvent(pointerEvent('pointerdown', 1));
      for (let i = 0; i < 30; i++) {
        jump.dispatchEvent(pointerEvent('pointerdown', 2 + i));
        jump.dispatchEvent(pointerEvent('pointerup', 2 + i));
      }
      expect(calls(Actions.MOVE_RIGHT)).toEqual([true]);
      expect(calls(Actions.JUMP)).toHaveLength(60);
      right.dispatchEvent(pointerEvent('pointerup', 1));
      expect(calls(Actions.MOVE_RIGHT)).toEqual([true, false]);
    });

    it('releases a button only when its last finger lifts', () => {
      const { left, calls } = setup();
      left.dispatchEvent(pointerEvent('pointerdown', 1));
      left.dispatchEvent(pointerEvent('pointerdown', 2));
      expect(calls(Actions.MOVE_LEFT)).toEqual([true]);
      left.dispatchEvent(pointerEvent('pointerup', 1));
      expect(calls(Actions.MOVE_LEFT)).toEqual([true]);
      left.dispatchEvent(pointerEvent('pointerup', 2));
      expect(calls(Actions.MOVE_LEFT)).toEqual([true, false]);
    });

    it('ignores the release of a finger it never saw press', () => {
      const { jump, onAction } = setup();
      jump.dispatchEvent(pointerEvent('pointerup', 9));
      expect(onAction).not.toHaveBeenCalled();
    });

    it('releases on lost pointer capture', () => {
      const { right, calls } = setup();
      right.dispatchEvent(pointerEvent('pointerdown', 1));
      right.dispatchEvent(pointerEvent('lostpointercapture', 1));
      expect(calls(Actions.MOVE_RIGHT)).toEqual([true, false]);
    });

    it('keeps a captured finger held when it drifts off the button', () => {
      const { right, calls } = setup();
      right.hasPointerCapture = () => true;
      right.dispatchEvent(pointerEvent('pointerdown', 1));
      right.dispatchEvent(pointerEvent('pointerleave', 1));
      expect(calls(Actions.MOVE_RIGHT)).toEqual([true]);
    });

    it('captures the pointer on the listening button, not the inner target', () => {
      const { jump } = setup();
      const inner = document.createElement('span');
      jump.append(inner);
      jump.setPointerCapture = vi.fn();
      inner.setPointerCapture = vi.fn();
      inner.dispatchEvent(pointerEvent('pointerdown', 4));
      expect(jump.setPointerCapture).toHaveBeenCalledWith(4);
      expect(inner.setPointerCapture).not.toHaveBeenCalled();
    });

    it('releaseHeld forgets old fingers so a stale lift cannot cancel a new press', () => {
      const { right, adapter, calls } = setup();
      right.dispatchEvent(pointerEvent('pointerdown', 1));
      adapter.releaseHeld();
      expect(calls(Actions.MOVE_RIGHT)).toEqual([true, false]);
      right.dispatchEvent(pointerEvent('pointerdown', 2));
      right.dispatchEvent(pointerEvent('pointerup', 1));
      expect(calls(Actions.MOVE_RIGHT)).toEqual([true, false, true]);
    });

    it('releases held actions on detach and survives attach/detach cycles', () => {
      const { left, adapter, calls } = setup();
      left.dispatchEvent(pointerEvent('pointerdown', 1));
      adapter.detach();
      expect(calls(Actions.MOVE_LEFT)).toEqual([true, false]);
      adapter.attach();
      left.dispatchEvent(pointerEvent('pointerdown', 2));
      left.dispatchEvent(pointerEvent('pointerup', 2));
      expect(calls(Actions.MOVE_LEFT)).toEqual([true, false, true, false]);
    });
  });

  describe('held feedback (docs/18 §9)', () => {
    function setup() {
      const left = document.createElement('button');
      const jump = document.createElement('button');
      const held = new Map();
      const onHeldChange = vi.fn((action, value) => held.set(action, value));
      const adapter = new TouchAdapter(vi.fn(), {
        buttons: [{ element: left, action: Actions.MOVE_LEFT }, { element: jump, action: Actions.JUMP }],
        onHeldChange,
      });
      adapter.attach();
      return { left, jump, held, onHeldChange, adapter };
    }

    it('shows direction and jump independently; lifting one finger keeps the other', () => {
      const { left, jump, held } = setup();
      left.dispatchEvent(pointerEvent('pointerdown', 1));
      jump.dispatchEvent(pointerEvent('pointerdown', 2));
      expect(held.get(Actions.MOVE_LEFT)).toBe(true);
      expect(held.get(Actions.JUMP)).toBe(true);
      jump.dispatchEvent(pointerEvent('pointerup', 2));
      expect(held.get(Actions.JUMP)).toBe(false);
      expect(held.get(Actions.MOVE_LEFT)).toBe(true);
    });

    it('reports a button once even with two fingers on it', () => {
      const { left, onHeldChange } = setup();
      left.dispatchEvent(pointerEvent('pointerdown', 1));
      left.dispatchEvent(pointerEvent('pointerdown', 2));
      left.dispatchEvent(pointerEvent('pointerup', 1));
      expect(onHeldChange).toHaveBeenCalledTimes(1);
      left.dispatchEvent(pointerEvent('pointerup', 2));
      expect(onHeldChange).toHaveBeenLastCalledWith(Actions.MOVE_LEFT, false);
    });

    it('clears every held look together with the actions on reset (pause) and detach', () => {
      const { left, jump, held, adapter } = setup();
      left.dispatchEvent(pointerEvent('pointerdown', 1));
      jump.dispatchEvent(pointerEvent('pointerdown', 2));
      adapter.releaseHeld();
      expect([...held.values()]).toEqual([false, false]);

      left.dispatchEvent(pointerEvent('pointerdown', 3));
      adapter.detach();
      expect(held.get(Actions.MOVE_LEFT)).toBe(false);
    });
  });
});
