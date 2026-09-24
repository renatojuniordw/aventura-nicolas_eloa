// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MemoryStorageAdapter } from './storage-adapter.js';
import { ExperienceSettingsStore, DEFAULT_EXPERIENCE_SETTINGS } from './experience-settings-store.js';

describe('ExperienceSettingsStore', () => {
  it('uses safe defaults and persists updates', () => {
    const store = new ExperienceSettingsStore(new MemoryStorageAdapter());
    expect(store.read()).toEqual(DEFAULT_EXPERIENCE_SETTINGS);
    store.update({ supportLevel: 'assisted', highContrast: true });
    expect(store.read()).toMatchObject({ supportLevel: 'assisted', highContrast: true });
  });

  it('applies accessibility preferences to the document', () => {
    const store = new ExperienceSettingsStore(new MemoryStorageAdapter());
    store.write({ ...DEFAULT_EXPERIENCE_SETTINGS, reducedMotion: true, largeText: true, colorVision: 'deuteranopia' });
    expect(document.documentElement.dataset.motion).toBe('reduced');
    expect(document.documentElement.dataset.textSize).toBe('large');
    expect(document.documentElement.dataset.colorVision).toBe('deuteranopia');
  });
});
