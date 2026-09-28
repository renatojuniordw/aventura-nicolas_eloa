// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { computeHudSafeArea, createHudSafeArea } from './hud-safe-area.js';

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const none = { top: 0, right: 0, bottom: 0, left: 0 };
const canvasSize = { width: 960, height: 540 };

describe('computeHudSafeArea', () => {
  it('converts the button bar from CSS px into canvas units', () => {
    // 667 × 375 phone: three 48 px buttons + two 8 px gaps, 10 px from the corner.
    const area = computeHudSafeArea({
      canvas: rect(0, 0, 667, 375),
      canvasSize,
      controls: rect(497, 10, 160, 48),
      insets: none,
      page: { width: 667, height: 375 },
    });
    expect(area.displayScale).toBeCloseTo(667 / 960);
    expect(area.controls.left).toBeCloseTo(497 * (960 / 667));
    expect(area.controls.bottom).toBeCloseTo(58 * (540 / 375));
  });

  it('ignores buttons that sit in a letterbox band beside the canvas', () => {
    const area = computeHudSafeArea({
      canvas: rect(80, 0, 714, 402),
      canvasSize,
      controls: rect(800, 10, 64, 48),
      insets: none,
      page: { width: 874, height: 402 },
    });
    expect(area.controls).toBeNull();
  });

  it('counts only the part of a notch that reaches into the canvas', () => {
    const area = computeHudSafeArea({
      canvas: rect(30, 0, 814, 458),
      canvasSize,
      controls: null,
      insets: { top: 0, right: 59, bottom: 21, left: 59 },
      page: { width: 874, height: 458 },
    });
    const sx = 960 / 814;
    expect(area.left).toBeCloseTo(29 * sx);
    expect(area.right).toBeCloseTo(29 * sx);
    expect(area.top).toBe(0);
  });

  it('returns null before the canvas has a size (hidden, tests)', () => {
    expect(computeHudSafeArea({ canvas: rect(0, 0, 0, 0), canvasSize, controls: null, insets: none, page: { width: 0, height: 0 } })).toBeNull();
  });
});

describe('createHudSafeArea', () => {
  it('measures lazily and cleans its probe up', () => {
    const canvas = document.createElement('canvas');
    const root = document.createElement('div');
    document.body.append(canvas, root);
    const area = createHudSafeArea({ canvas, controlsRoot: root });
    expect(area.read()).toBeNull(); // jsdom has no layout
    const probes = document.body.children.length;
    area.dispose();
    expect(document.body.children.length).toBe(probes - 1);
  });
});
