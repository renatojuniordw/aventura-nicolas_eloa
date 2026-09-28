import { Actions } from '../input/actions.js';

/**
 * Step logic for "Experimentar controles" (docs/18 §8), free of DOM, canvas
 * and timers: it only hears what the player actually did through the
 * semantic actions (holding a direction, a jump that really happened) and
 * advances one step at a time. No step ever expires — nothing here rushes the
 * child — and the practice never touches lessons, stars, records or support.
 */
export type PracticeStep = 'move' | 'jump' | 'combo' | 'done';

export interface PracticeFrame {
  dt: number;
  /** -1, 0 or 1, from InputManager.getMoveAxis(). */
  moveAxis: number;
  /** The character actually left the ground this step (not merely a finger on the button). */
  jumped: boolean;
}

/** Seconds a direction must be held (cumulatively) to count as "walking". */
export const MOVE_HOLD_SECONDS = 0.5;

const ORDER: PracticeStep[] = ['move', 'jump', 'combo', 'done'];

export class ControlsPractice {
  private _step: PracticeStep = 'move';
  private _held = 0;

  get step(): PracticeStep {
    return this._step;
  }

  get stepNumber(): number {
    return Math.min(ORDER.indexOf(this._step) + 1, ORDER.length - 1);
  }

  get totalSteps(): number {
    return ORDER.length - 1;
  }

  get done(): boolean {
    return this._step === 'done';
  }

  /** Returns true when this frame moved to a new step. */
  update({ dt, moveAxis, jumped }: PracticeFrame): boolean {
    switch (this._step) {
      case 'move':
        if (moveAxis !== 0) this._held += dt;
        return this._held >= MOVE_HOLD_SECONDS ? this._advance() : false;
      case 'jump':
        return jumped ? this._advance() : false;
      case 'combo':
        return jumped && moveAxis !== 0 ? this._advance() : false;
      default:
        return false;
    }
  }

  restart(): void {
    this._step = 'move';
    this._held = 0;
  }

  private _advance(): boolean {
    this._step = ORDER[ORDER.indexOf(this._step) + 1]!;
    return true;
  }
}

/** Which on-screen buttons each step points at (never covered by the coach). */
export function hintedActions(step: PracticeStep): string[] {
  if (step === 'move') return [Actions.MOVE_LEFT, Actions.MOVE_RIGHT];
  if (step === 'jump') return [Actions.JUMP];
  if (step === 'combo') return [Actions.MOVE_LEFT, Actions.MOVE_RIGHT, Actions.JUMP];
  return [];
}

/** Short instruction per step, worded for the input the child is using. */
export function practiceText(step: PracticeStep, isTouch: boolean): { title: string; body: string } {
  const move = isTouch ? '◀ ou ▶' : '← ou →';
  const jump = isTouch ? '⤒' : 'Espaço';
  switch (step) {
    case 'move':
      return { title: 'Andar', body: `Segure ${move} para andar.` };
    case 'jump':
      return { title: 'Pular', body: `${isTouch ? 'Toque em' : 'Aperte'} ${jump} para pular.` };
    case 'combo':
      return { title: 'Andar e pular', body: `Segure ${move} e ${isTouch ? 'toque em' : 'aperte'} ${jump} ao mesmo tempo.` };
    default:
      return { title: 'Muito bem!', body: `Dica: segurar ${jump} por mais tempo faz pular mais alto.` };
  }
}
