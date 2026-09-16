import { Scene } from '../core/scene.js';
import { Actions } from '../input/actions.js';
import { COLORS } from '../core/config.js';
import { getCharacter } from '../content/characters.js';

/**
 * Level-complete screen: stars earned, celebration, and a shortcut to the next
 * lesson. Progress was already persisted by the game scene.
 */
export class VictoryScene extends Scene {
  enter({ lessonId, stars = 0, mistakes = 0 } = {}) {
    this.lesson = this.game.curriculum.getLesson(lessonId);
    const profile = this.game.profiles.getActiveProfile();
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

  exit() {
    this.game.menu.hide();
    this.game.effects.clear();
  }

  update(dt) {
    this.game.effects.update(dt);
    if (this.game.input.consumePressed(Actions.CONFIRM)) this.game.menu.triggerPrimary();
    if (this.game.input.consumePressed(Actions.BACK)) this.game.menu.triggerBack();
  }

  draw(renderer) {
    renderer.clear(COLORS.sky);
    // Effects are world-space; reset the camera so they land on screen.
    renderer.setCamera(0, 0);
    this.game.effects.draw(renderer);
  }
}
