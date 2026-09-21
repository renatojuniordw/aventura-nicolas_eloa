// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isStandalone,
  isPwaInstallable,
  onPwaInstallableChange,
  initPwaInstallListener,
  promptPwaInstall,
} from './pwa-install.js';

describe('pwa-install', () => {
  beforeEach(() => {
    initPwaInstallListener();
  });

  it('detects non-standalone by default in test env', () => {
    expect(isStandalone()).toBe(false);
  });

  it('reports not installable before event triggers', () => {
    expect(isPwaInstallable()).toBe(false);
  });

  it('notifies subscribers when beforeinstallprompt fires and allows prompting', async () => {
    const listener = vi.fn();
    const unsub = onPwaInstallableChange(listener);

    expect(listener).toHaveBeenCalledWith(false);

    const mockPromptEvent = new Event('beforeinstallprompt');
    mockPromptEvent.prompt = vi.fn().mockResolvedValue(undefined);
    mockPromptEvent.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    window.dispatchEvent(mockPromptEvent);

    expect(listener).toHaveBeenCalledWith(true);
    expect(isPwaInstallable()).toBe(true);

    const outcome = await promptPwaInstall();
    expect(outcome).toBe('accepted');
    expect(mockPromptEvent.prompt).toHaveBeenCalledTimes(1);

    expect(isPwaInstallable()).toBe(false);

    unsub();
  });
});
