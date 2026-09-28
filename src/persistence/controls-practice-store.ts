import { CONTROLS_PRACTICE_KEY } from './storage-keys.js';
import type { StorageAdapter } from './storage-adapter.js';

export interface ControlsPracticeState {
  /** The first-use offer was shown (accepted or declined): never ask again. */
  offered: boolean;
  /** Reached the last step at least once. */
  completed: boolean;
}

/**
 * Whether the controls practice was offered/completed on this device
 * (docs/18 §8). Separate from SaveStore on purpose: it is not learning
 * progress, so resetting progress or switching profiles never touches it.
 */
export class ControlsPracticeStore {
  constructor(private readonly adapter: StorageAdapter) {}

  read(): ControlsPracticeState {
    try {
      const value = JSON.parse(this.adapter.read(CONTROLS_PRACTICE_KEY) ?? '{}') as Partial<ControlsPracticeState>;
      return { offered: value.offered === true, completed: value.completed === true };
    } catch {
      return { offered: false, completed: false };
    }
  }

  markOffered(): void {
    this._write({ ...this.read(), offered: true });
  }

  markCompleted(): void {
    this._write({ offered: true, completed: true });
  }

  private _write(value: ControlsPracticeState): void {
    this.adapter.write(CONTROLS_PRACTICE_KEY, JSON.stringify(value));
  }
}
