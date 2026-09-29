import { FeedbackKind, type HudModel } from '../render/hud-model.js';
import { formatTime } from '../content/text-utils.js';

/**
 * What the DOM HUD shows (docs/17 §4, entrega 5): a plain, comparable copy of
 * the HudModel. The game scene builds one per frame; the view re-renders only
 * when `hudSnapshotKey` changes, so the speedrun clock updates at its own
 * resolution and nothing re-renders every frame.
 */
export interface HudSnapshot {
  levelName: string;
  objective: string;
  lives: number;
  maxLives: number;
  /** Timer and/or progress ("⏱️ 01:02 · 3/10"); empty hides the badge. */
  badge: string;
  /** Explorar letter board; empty hides it. */
  board: Array<{ char: string; revealed: boolean; isNext: boolean }>;
  feedback: { kind: 'correct' | 'wrong' | 'hint'; message: string } | null;
}

export function hudSnapshot(model: HudModel): HudSnapshot {
  let badge = '';
  if (model.isSpeedrun) {
    const time = model.showTimer ? `⏱️ ${formatTime(model.timer)}` : '';
    badge = [time, model.speedrunProgress].filter(Boolean).join(' · ');
  }
  const kind = model.feedback.kind;
  return {
    levelName: model.levelName,
    objective: model.objective,
    lives: Math.min(model.lives, model.maxLives),
    maxLives: model.maxLives,
    badge,
    board: model.boardSlots,
    feedback:
      model.isFeedbackVisible && kind !== FeedbackKind.NONE
        ? { kind: kind as 'correct' | 'wrong' | 'hint', message: model.feedback.message }
        : null,
  };
}

export function hudSnapshotKey(snapshot: HudSnapshot): string {
  return JSON.stringify(snapshot);
}
