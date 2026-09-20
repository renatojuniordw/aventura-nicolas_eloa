// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isHapticsSupported,
  vibrate,
  vibrateJump,
  vibrateCollect,
  vibrateVictory,
  vibrateWarning,
  cancelHaptics,
} from './haptics.js';

describe('haptics', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn().mockReturnValue(true),
      writable: true,
      configurable: true,
    });
  });

  it('detects vibration support correctly', () => {
    expect(isHapticsSupported()).toBe(true);

    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(isHapticsSupported()).toBe(false);
    expect(vibrate(10)).toBe(false);
  });

  it('calls vibrate with jump duration', () => {
    const success = vibrateJump();
    expect(success).toBe(true);
    expect(navigator.vibrate).toHaveBeenCalledWith(15);
  });

  it('calls vibrate with collect duration', () => {
    const success = vibrateCollect();
    expect(success).toBe(true);
    expect(navigator.vibrate).toHaveBeenCalledWith(35);
  });

  it('calls vibrate with victory rhythm', () => {
    const success = vibrateVictory();
    expect(success).toBe(true);
    expect(navigator.vibrate).toHaveBeenCalledWith([40, 60, 40, 60, 100]);
  });

  it('calls vibrate with warning pattern', () => {
    const success = vibrateWarning();
    expect(success).toBe(true);
    expect(navigator.vibrate).toHaveBeenCalledWith([30, 40, 30]);
  });

  it('cancels vibration on cancelHaptics()', () => {
    cancelHaptics();
    expect(navigator.vibrate).toHaveBeenCalledWith(0);
  });
});
