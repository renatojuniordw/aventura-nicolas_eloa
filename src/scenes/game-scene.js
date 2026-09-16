import { Scene } from '../core/scene.js';
import { Actions } from '../input/actions.js';
import { Events } from '../core/event-bus.js';
import { GAMEPLAY } from '../core/config.js';
import { PhysicsEngine } from '../physics/physics-engine.js';
import { PlayerController } from '../gameplay/player/player-controller.js';
import { LivesManager } from '../gameplay/lives-manager.js';
import { LevelManager } from '../gameplay/level-manager.js';
import { AnswerValidator } from '../content/answer-validator.js';
import { getLevelData } from '../content/level-registry.js';
import { loadLevel } from '../content/level-loader.js';
import { getCharacter } from '../content/characters.js';
import { Camera } from '../render/camera.js';
import { FeedbackKind, HudModel } from '../render/hud-model.js';
import { buildSpeedrunCourse } from '../gameplay/speedrun-course.js';

const Status = Object.freeze({
  RUNNING: 'running',
  PAUSED: 'paused',
  WON: 'won',
  GAME_OVER: 'gameOver',
});

/**
 * Orchestrates one lesson: reads the abstracted input, drives the player
 * controller, runs physics/collisions, reacts to level events through the bus
 * and renders the world plus HUD.
 *
 * It is the only place that connects input -> gameplay -> rules, which keeps
 * every one of those pieces independent and testable.
 */
export class GameScene extends Scene {
  constructor(game) {
    super(game);
    this.physics = new PhysicsEngine();
    /** @type {Array<() => void>} */
    this._unsubscribers = [];
  }

  enter({ lessonId, mode = 'normal', speedrunCourse = null, speedrunState = null } = {}) {
    this.mode = mode;
    this.mistakes = 0;
    this.status = Status.RUNNING;
    this._winTimer = 0;

    if (this.mode === 'speedrun') {
      const course = speedrunCourse ?? buildSpeedrunCourse();
      this.level = course;
      this.speedrunCheckpoints = course.checkpoints;
      this.alphabet = course.alphabet;
      this.currentIndex = 0;
      this.speedrunElapsed = speedrunState?.elapsed ?? 0;

      const firstLetter = this.alphabet[0];
      this.lesson = this.game.curriculum?.getLesson?.(`alfabeto-${firstLetter.toLowerCase()}`) ?? {
        id: `alfabeto-${firstLetter.toLowerCase()}`,
        target: firstLetter,
        objective: `Colete a letra ${firstLetter}`,
      };
      this.validator = new AnswerValidator(this.lesson);
    } else {
      const lesson = this.game.curriculum.getLesson(lessonId);
      if (!lesson) throw new Error(`Unknown lesson: ${lessonId}`);
      const levelData = getLevelData(lesson.levelId);
      if (!levelData) throw new Error(`Missing level file for lesson ${lessonId}`);

      this.lesson = lesson;
      this.level = loadLevel(levelData);
      this.validator = new AnswerValidator(lesson);
    }

    this.levelManager = new LevelManager({ level: this.level, bus: this.game.bus });
    this.lives = new LivesManager({ lives: GAMEPLAY.startingLives, bus: this.game.bus });

    this.player = new PlayerController({
      x: this.level.playerStart.x,
      y: this.level.playerStart.y,
      physics: this.physics,
    });
    this.camera = new Camera({
      viewport: this.level.viewport,
      maxX: this.level.camera.maxX,
      startX: this.level.camera.startX,
      smoothing: this.level.camera.smoothing,
    });
    this.camera.snapTo(this.player.body);

    const isSpeedrun = this.mode === 'speedrun';
    const progressText = isSpeedrun && this.alphabet
      ? `1/${this.alphabet.length}`
      : '';

    this.hudModel = new HudModel({
      objective: this.lesson.objective,
      levelName: this.level.name,
      lives: this.lives.lives,
      maxLives: this.lives.maxLives,
      isSpeedrun,
      timer: this.speedrunElapsed ?? 0,
      speedrunProgress: progressText,
    });
    this.character = getCharacter(this.game.profiles.getActiveProfile()?.characterId);

    this.game.sprites.setLevel(this.level);
    this._subscribe();
    this.game.hudControls.showPauseButton({ onPause: () => this.togglePause() });
    if (this.game.device?.isTouch) this.game.touchControls.show();
    this.game.bus.emit(Events.LESSON_STARTED, { lesson: this.lesson });
  }

  exit() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    this._unsubscribers = [];
    this.game.menu.hide();
    this.game.hudControls.hidePauseButton();
    this.game.touchControls.hide();
    this.game.effects.clear();
  }

  update(dt) {
    if (this.game.input.consumePressed(Actions.DEBUG)) {
      this.game.debug.toggle();
    }
    if (this.game.input.consumePressed(Actions.PAUSE)) {
      this.togglePause();
    }

    if (this.status === Status.PAUSED || this.status === Status.GAME_OVER) return;

    if (this.mode === 'speedrun') {
      this.speedrunElapsed = (this.speedrunElapsed ?? 0) + dt;
      this.hudModel.setTimer(this.speedrunElapsed);
    }

    if (this.status === Status.WON) {
      this._winTimer -= dt;
      this.game.effects.update(dt);
      this.hudModel.update(dt);
      if (this._winTimer <= 0) this.finishLevel();
      return;
    }

    this._applyInput();
    this.player.update(dt, this.level);
    this.levelManager.update(this.player);
    this.camera.follow(this.player.body);
    this.hudModel.update(dt);
    this.game.effects.update(dt);
  }

  draw(renderer) {
    this.game.sprites.drawBackground(renderer, this.camera?.x ?? 0);
    renderer.setCamera(this.camera.x, this.camera.y);
    this.game.sprites.drawTerrain(renderer);
    this.game.sprites.drawObjects(
      renderer,
      this.level,
      this.mode === 'speedrun' ? this.speedrunCheckpoints : null,
    );
    this.game.sprites.drawItems(renderer, this.level.items, this.levelManager.collected);
    this.game.sprites.drawHazards(renderer, this.level.hazards);
    this.game.sprites.drawPlayer(renderer, this.player, this.character);
    this.game.effects.draw(renderer);

    if (this.game.debug.enabled) {
      this.game.sprites.drawDebug(renderer, {
        player: this.player,
        level: this.level,
        items: this.level.items,
        hazards: this.level.hazards,
      });
    }

    this.game.hud.draw(this.hudModel);
  }

  // --- Input -> semantic player calls --------------------------------------

  /**
   * The ONLY bridge from input to gameplay. Note that no jump rule lives here:
   * this asks the controller to try, and the controller decides.
   */
  _applyInput() {
    const axis = this.game.input.getMoveAxis();
    if (axis < 0) this.player.moveLeft();
    else if (axis > 0) this.player.moveRight();
    else this.player.stop();

    if (this.game.input.consumePressed(Actions.JUMP)) this.player.jump();
    this.player.holdJump(this.game.input.isActionHeld(Actions.JUMP));
  }

  // --- Event reactions ------------------------------------------------------

  _subscribe() {
    const on = (event, handler) => this._unsubscribers.push(this.game.bus.on(event, handler));

    on(Events.ITEM_COLLECTED, ({ item }) => this.onItemCollected(item));
    on(Events.HAZARD_HIT, () => this.onHazardHit());
    on(Events.PLAYER_FELL, () => this.respawn());
    on(Events.LIVES_CHANGED, ({ lives, maxLives }) => {
      this.hudModel.setLives(lives);
      this.hudModel.maxLives = maxLives;
    });
    on(Events.LIVES_DEPLETED, () => this.onGameOver());
    on(Events.APP_BLURRED, () => this.pause());
  }

  onItemCollected(item) {
    if (this.mode === 'speedrun' && item.segmentIndex != null && item.segmentIndex > this.currentIndex) {
      this.levelManager.collected.delete(item.id);
      this.hudModel.showFeedback(
        FeedbackKind.WRONG,
        `Ops! Colete a letra "${this.lesson.target}" primeiro!`,
        1.2,
      );
      return;
    }

    const { ok } = this.validator.validate(item);
    const centerX = item.x + item.w / 2;
    const centerY = item.y + item.h / 2;
    const profile = this.game.profiles.getActiveProfile();

    if (ok) {
      this._handleCorrectAnswer(item, profile, centerX, centerY);
      return;
    }

    this._handleWrongAnswer(item, profile, centerX, centerY);
  }

  /** Correct-answer flow: record, celebrate, then advance (speedrun) or win (normal). */
  _handleCorrectAnswer(item, profile, centerX, centerY) {
    if (profile) this.game.progress.recordAnswer(profile.id, true);
    this.game.effects.spawnConfetti(centerX, centerY, 56);

    if (this.mode === 'speedrun' && this.alphabet) {
      this._advanceSpeedrun();
      return;
    }

    this.hudModel.showFeedback(
      FeedbackKind.CORRECT,
      'Muito bem! Você encontrou!',
      GAMEPLAY.wrongFeedbackDuration,
    );
    this.winLevel();
  }

  /** Speedrun advance: next letter checkpoint, or marathon victory on Z. */
  _advanceSpeedrun() {
    if (this.currentIndex < this.alphabet.length - 1) {
      this.currentIndex += 1;
      const nextLetter = this.alphabet[this.currentIndex];
      const nextLesson = this.game.curriculum?.getLesson?.(`alfabeto-${nextLetter.toLowerCase()}`) ?? {
        id: `alfabeto-${nextLetter.toLowerCase()}`,
        target: nextLetter,
        objective: `Colete a letra ${nextLetter}`,
      };
      this.lesson = nextLesson;
      this.validator = new AnswerValidator(this.lesson);
      if (this.speedrunCheckpoints?.[this.currentIndex]) {
        this.levelManager.setCheckpoint({ ...this.speedrunCheckpoints[this.currentIndex] });
      }

      this.hudModel.setObjective(this.lesson.objective);
      this.hudModel.setSpeedrunProgress(`${this.currentIndex + 1}/${this.alphabet.length}`);
      this.hudModel.showFeedback(
        FeedbackKind.CORRECT,
        `Boa! Agora letra ${nextLetter}!`,
        0.8,
      );
      // Continuous! The player does NOT stop, does NOT reload scene, keeps running!
      return;
    }

    // Collected Z! Venceu a maratona!
    this.hudModel.showFeedback(FeedbackKind.CORRECT, 'Parabéns! Maratona concluída!', 1.5);
    this.winLevel();
  }

  /** Wrong-answer flow: count the mistake, cost a heart, show guidance. */
  _handleWrongAnswer(item, profile, centerX, centerY) {
    this.mistakes += 1;
    if (profile) this.game.progress.recordAnswer(profile.id, false);
    this.lives.loseHeart();
    this.game.effects.spawnPuff(centerX, centerY, 14, '#ff5d73');
    this.hudModel.showFeedback(
      FeedbackKind.WRONG,
      `Ops! Esse era "${item.label}". Procure "${this.lesson.target}".`,
      GAMEPLAY.wrongFeedbackDuration,
    );
  }

  onHazardHit() {
    this.lives.loseHeart();
    this.hudModel.showFeedback(
      FeedbackKind.WRONG,
      'Ai! Cuidado com os espinhos!',
      GAMEPLAY.wrongFeedbackDuration,
    );
    this.respawn();
  }

  /** Falling costs no heart — the player just returns to the checkpoint. */
  respawn() {
    this.player.reset(this.levelManager.getRespawnPoint());
    this.levelManager.resetTransientState();
    this.camera.snapTo(this.player.body);
    this.game.effects.clear();
  }

  winLevel() {
    this.status = Status.WON;
    this._winTimer = this.mode === 'speedrun' ? 1.2 : GAMEPLAY.celebrationDuration;
    this.game.effects.spawnConfetti(
      this.player.body.x + this.player.body.w / 2,
      this.player.body.y,
      96,
    );
  }

  finishLevel() {
    const profile = this.game.profiles.getActiveProfile();

    if (this.mode === 'speedrun') {
      const elapsed = this.speedrunElapsed ?? 0;
      const result = profile
        ? this.game.progress.recordSpeedrunTime(profile.id, elapsed)
        : { bestTime: elapsed, isNewBest: true };

      this.game.scenes.switchTo('victory', {
        mode: 'speedrun',
        elapsed,
        mistakes: this.mistakes,
        isNewBest: result?.isNewBest ?? false,
        bestTime: result?.bestTime ?? elapsed,
        totalLetters: this.alphabet?.length ?? 26,
      });
      return;
    }

    const entry = profile
      ? this.game.progress.completeLesson(profile.id, this.lesson.id, { mistakes: this.mistakes })
      : null;

    this.game.scenes.switchTo('victory', {
      lessonId: this.lesson.id,
      mistakes: this.mistakes,
      stars: entry?.stars ?? 0,
    });
  }

  onGameOver() {
    this.status = Status.GAME_OVER;
    if (this.mode === 'speedrun') {
      this.game.menu.showGameOver({
        lesson: this.lesson,
        onRetry: () => this.game.startSpeedrun(),
        onMenu: () => this.game.scenes.switchTo('menu'),
      });
      return;
    }
    this.game.menu.showGameOver({
      lesson: this.lesson,
      onRetry: () => this.game.scenes.switchTo('game', { lessonId: this.lesson.id }),
      onMenu: () => this.game.scenes.switchTo('menu'),
    });
  }

  // --- Pause ----------------------------------------------------------------

  togglePause() {
    if (this.status === Status.PAUSED) this.resume();
    else this.pause();
  }

  pause() {
    if (this.status !== Status.RUNNING) return;
    this.status = Status.PAUSED;
    this.game.input.reset();
    this._showPauseMenu();
  }

  _showPauseMenu() {
    this.game.menu.showPause({
      isSpeedrun: this.mode === 'speedrun',
      isMuted: this.game.audio.isMuted,
      onResume: () => this.resume(),
      onRestart: () => {
        if (this.mode === 'speedrun') {
          this.game.startSpeedrun();
        } else {
          this.game.scenes.switchTo('game', { lessonId: this.lesson.id });
        }
      },
      onMenu: () => this.game.scenes.switchTo('menu'),
      onToggleMute: () => {
        this.game.audio.toggleMuted();
        this._showPauseMenu();
      },
    });
  }

  resume() {
    if (this.status !== Status.PAUSED) return;
    this.status = Status.RUNNING;
    this.game.menu.hide();
    // Clear held keys so the player does not keep running after resuming.
    this.game.input.reset();
  }
}
