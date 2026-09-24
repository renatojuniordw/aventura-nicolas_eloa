import { Scene } from '../core/scene.js';
import { JumpConfirmGesture } from '../input/jump-confirm-gesture.js';
import { COLORS } from '../core/config.js';
import { getCharacter } from '../content/characters.js';
import { WORD_PHASE_ORDER, getWordByPhaseId, wordPhaseId } from '../content/word-phases.js';
import { pumpOverlayInput } from '../ui/overlay-input.js';
import type { CanvasRenderer } from '../render/canvas-renderer.js';
import type { Lesson } from '../content/curriculum-model.js';

interface VictoryParams {
  lessonId?: string;
  stars?: number;
  mistakes?: number;
  mode?: 'normal' | 'speedrun' | 'explore';
  elapsed?: number;
  isNewBest?: boolean;
  bestTime?: number;
  totalLetters?: number;
  wordId?: string;
}

/**
 * Level-complete screen: stars earned, celebration, and a shortcut to the next
 * lesson. Progress was already persisted by the game scene.
 */
export class VictoryScene extends Scene {
  lesson: Lesson | null = null;
  nextLessonId: string | null = null;
  hasNext = false;
  private _jumpGesture = new JumpConfirmGesture();

  override enter({
    lessonId,
    stars = 0,
    mistakes = 0,
    mode = 'normal',
    elapsed = 0,
    isNewBest = false,
    bestTime = 0,
    totalLetters = 26,
    wordId,
  }: VictoryParams = {}): void {
    this._jumpGesture.reset();
    const profile = this.game.profiles.getActiveProfile();

    if (mode === 'speedrun') {
      this.game.effects.spawnConfetti(this.game.renderer.width / 2, 140, 96);
      this.game.menu.showSpeedrunVictory({
        character: getCharacter(profile?.characterId),
        elapsed,
        mistakes,
        isNewBest,
        bestTime,
        totalLetters,
        onReplay: () => this.game.startSpeedrun(),
        onMenu: () => this.game.scenes.switchTo('menu'),
      });
      return;
    }

    if (mode === 'explore') {
      const word = getWordByPhaseId(wordPhaseId(wordId ?? ''));
      const nextPhaseId = profile ? this.game.progress.getNextLesson(profile.id, WORD_PHASE_ORDER) : null;
      const nextWordId = getWordByPhaseId(nextPhaseId)?.id ?? null;
      this.game.effects.spawnConfetti(this.game.renderer.width / 2, 140, 96);
      this.game.menu.showExploreVictory({
        character: getCharacter(profile?.characterId),
        word: word?.label ?? '',
        fact: word?.fact ?? '',
        stars,
        mistakes,
        hasNext: Boolean(nextWordId) && nextWordId !== wordId,
        onNext: () => this.game.startExploration(nextWordId ?? undefined),
        onReplay: () => this.game.startExploration(wordId),
        onMenu: () => this.game.scenes.switchTo('menu'),
      });
      return;
    }

    this.lesson = this.game.curriculum.getLesson(lessonId);
    this.nextLessonId = profile
      ? this.game.progress.getNextLesson(profile.id, this.game.curriculum.lessonOrder)
      : null;
    this.hasNext = Boolean(this.nextLessonId) && this.nextLessonId !== lessonId;

    this.game.effects.spawnConfetti(this.game.renderer.width / 2, 140, 64);

    this.game.menu.showVictory({
      lesson: this.lesson,
      character: getCharacter(profile?.characterId),
      stars,
      mistakes,
      hasNext: this.hasNext,
      onNext: () => this.game.startLesson(this.nextLessonId),
      onReplay: () => this.game.startLesson(lessonId),
      onMenu: () => this.game.scenes.switchTo('menu'),
    });
  }

  override exit(): void {
    this.game.menu.hide();
    this.game.effects.clear();
  }

  override update(dt: number): void {
    this.game.effects.update(dt);
    // One phone jump confirms (advance/replay), two in quick succession go back.
    pumpOverlayInput(this.game, this._jumpGesture);
  }

  override draw(renderer: CanvasRenderer): void {
    renderer.clear(COLORS.sky);
    // Effects are world-space; reset the camera so they land on screen.
    renderer.setCamera(0, 0);
    this.game.effects.draw(renderer);
  }
}
