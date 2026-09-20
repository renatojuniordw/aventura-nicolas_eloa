// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isFullscreenSupported, isFullscreen, toggleFullscreen, onFullscreenChange } from './fullscreen.js';

describe('fullscreen helper', () => {
  let originalExitFullscreen;
  let originalRequestFullscreen;

  beforeEach(() => {
    originalExitFullscreen = document.exitFullscreen;
    originalRequestFullscreen = document.documentElement.requestFullscreen;
  });

  afterEach(() => {
    document.exitFullscreen = originalExitFullscreen;
    document.documentElement.requestFullscreen = originalRequestFullscreen;
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });
  });

  it('detects when fullscreen is supported', () => {
    document.documentElement.requestFullscreen = vi.fn();
    expect(isFullscreenSupported()).toBe(true);
  });

  it('checks if document is currently fullscreen', () => {
    expect(isFullscreen()).toBe(false);

    Object.defineProperty(document, 'fullscreenElement', {
      value: document.documentElement,
      configurable: true,
    });
    expect(isFullscreen()).toBe(true);

    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });
    expect(isFullscreen()).toBe(false);
  });

  it('requests fullscreen when not currently active', async () => {
    const requestFullscreenMock = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = requestFullscreenMock;
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });

    const result = await toggleFullscreen();
    expect(requestFullscreenMock).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('exits fullscreen when currently active', async () => {
    const exitFullscreenMock = vi.fn().mockResolvedValue(undefined);
    document.exitFullscreen = exitFullscreenMock;
    Object.defineProperty(document, 'fullscreenElement', {
      value: document.documentElement,
      configurable: true,
    });

    const result = await toggleFullscreen();
    expect(exitFullscreenMock).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('registers and unregisters fullscreenchange listeners', () => {
    const listener = vi.fn();
    const cleanup = onFullscreenChange(listener);

    document.dispatchEvent(new Event('fullscreenchange'));
    expect(listener).toHaveBeenCalledWith(false);

    cleanup();
    listener.mockClear();
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(listener).not.toHaveBeenCalled();
  });
});
