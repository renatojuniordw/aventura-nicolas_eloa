import type { SupportLevel } from './support-policy.js';

/**
 * Progressive hint (docs/20 §5 F2): each press of "Dica" gives a little more
 * help — first the instruction again, then the reviewed syllable split of the
 * word, and finally a marker over the right answer (except in the challenge
 * support level). Asking for a hint never collects anything and never counts
 * as a mistake; the hint starts over when the target changes.
 */
export type HintStep = 'repeat' | 'segment' | 'highlight';

interface HintOptions {
  /** Reviewed syllables of the word, when there are any. */
  syllables?: readonly string[] | null;
  supportLevel: SupportLevel;
}

export function hintSteps({ syllables, supportLevel }: HintOptions): HintStep[] {
  const steps: HintStep[] = ['repeat'];
  if (syllables && syllables.length > 1) steps.push('segment');
  if (supportLevel !== 'challenge') steps.push('highlight');
  return steps;
}

export class ProgressiveHint {
  private _steps: HintStep[];
  private _used = 0;

  constructor(steps: HintStep[]) {
    this._steps = steps;
  }

  /** The next step to give; repeats the last one once every step was used. */
  next(): HintStep {
    const step = this._steps[Math.min(this._used, this._steps.length - 1)] ?? 'repeat';
    this._used += 1;
    return step;
  }

  /** How many hints were asked for the current target. */
  get used(): number {
    return this._used;
  }

  reset(steps: HintStep[] = this._steps): void {
    this._steps = steps;
    this._used = 0;
  }
}
