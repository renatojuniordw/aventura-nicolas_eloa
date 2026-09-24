import { EXPERIENCE_SETTINGS_KEY } from './storage-keys.js';
import type { StorageAdapter } from './storage-adapter.js';

export type SupportLevel = 'assisted' | 'standard' | 'challenge';
export type ColorVisionMode = 'default' | 'deuteranopia' | 'protanopia' | 'tritanopia';

export interface ExperienceSettings {
  supportLevel: SupportLevel;
  highContrast: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  colorVision: ColorVisionMode;
}

export const DEFAULT_EXPERIENCE_SETTINGS: ExperienceSettings = Object.freeze({
  supportLevel: 'standard',
  highContrast: false,
  reducedMotion: false,
  largeText: false,
  colorVision: 'default',
});

const SUPPORT_LEVELS = new Set<SupportLevel>(['assisted', 'standard', 'challenge']);
const COLOR_VISION_MODES = new Set<ColorVisionMode>(['default', 'deuteranopia', 'protanopia', 'tritanopia']);

export class ExperienceSettingsStore {
  constructor(private readonly adapter: StorageAdapter) {}

  read(): ExperienceSettings {
    const raw = this.adapter.read(EXPERIENCE_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_EXPERIENCE_SETTINGS };
    try {
      const value = JSON.parse(raw) as Partial<ExperienceSettings>;
      return {
        supportLevel: SUPPORT_LEVELS.has(value.supportLevel as SupportLevel) ? value.supportLevel as SupportLevel : 'standard',
        highContrast: value.highContrast === true,
        reducedMotion: value.reducedMotion === true,
        largeText: value.largeText === true,
        colorVision: COLOR_VISION_MODES.has(value.colorVision as ColorVisionMode) ? value.colorVision as ColorVisionMode : 'default',
      };
    } catch {
      return { ...DEFAULT_EXPERIENCE_SETTINGS };
    }
  }

  write(value: ExperienceSettings): void {
    this.adapter.write(EXPERIENCE_SETTINGS_KEY, JSON.stringify(value));
    this.apply(value);
  }

  update(patch: Partial<ExperienceSettings>): ExperienceSettings {
    const value = { ...this.read(), ...patch };
    this.write(value);
    return value;
  }

  apply(value = this.read()): void {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.contrast = value.highContrast ? 'high' : 'default';
    document.documentElement.dataset.motion = value.reducedMotion ? 'reduced' : 'default';
    document.documentElement.dataset.textSize = value.largeText ? 'large' : 'default';
    document.documentElement.dataset.colorVision = value.colorVision;
    document.documentElement.dataset.support = value.supportLevel;
  }
}
