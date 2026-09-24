import { Scene } from '../core/scene.js';
import { Actions } from '../input/actions.js';
import { JumpConfirmGesture } from '../input/jump-confirm-gesture.js';
import { Events } from '../core/event-bus.js';
import { GAMEPLAY } from '../core/config.js';
import { PhysicsEngine } from '../physics/physics-engine.js';
import { PlayerController } from '../gameplay/player/player-controller.js';
import { LivesManager } from '../gameplay/lives-manager.js';
import { LevelManager, type Level, type LevelItem, type Point } from '../gameplay/level-manager.js';
import { AnswerValidator } from '../content/answer-validator.js';
import { getLevelData } from '../content/level-registry.js';
import { loadLevel } from '../content/level-loader.js';
import { getCharacter } from '../content/characters.js';
import { Camera } from '../render/camera.js';
import { lessonAssets } from '../render/asset-plan.js';
import { FeedbackKind, HudModel } from '../render/hud-model.js';
import { buildSpeedrunCourse } from '../gameplay/speedrun-course.js';
import { FUTURE_HINT_INTERVAL, SpeedrunRun } from '../gameplay/speedrun-run.js';
import { buildExploreCourse } from '../gameplay/explore-course.js';
import { FUTURE_HINT_INTERVAL as EXPLORE_FUTURE_HINT_INTERVAL, ExploreRun } from '../gameplay/explore-run.js';
import { WORD_BANK } from '../content/word-bank.js';
import type { CanvasRenderer } from '../render/canvas-renderer.js';
import type { Lesson } from '../content/curriculum-model.js';
import { vibrateJump, vibrateCollect, vibrateVictory, vibrateWarning } from '../input/haptics.js';
import { tryLockLandscape } from '../ui/orientation.js';
import { pumpMenuKeys, pumpOverlayInput } from '../ui/overlay-input.js';

const Status = Object.freeze({
  RUNNING: 'running',
  PAUSED: 'paused',
  WON: 'won',
  GAME_OVER: 'gameOver',
});

type StatusValue = (typeof Status)[keyof typeof Status];

/** Level shape plus the extra fields game-scene reads (playerStart, camera, viewport, name). */
interface GameLevel extends Level {
  name: string;
  playerStart: Point;
  viewport: unknown;
  camera: { maxX: number; startX: number; smoothing: number };
  checkpoints?: Point[];
  alphabet?: string[];
}

interface EnterParams {
  lessonId?: string;
  mode?: 'normal' | 'speedrun' | 'explore';
  speedrunCourse?: GameLevel | null;
  speedrunState?: { elapsed?: number } | null;
  exploreCourse?: GameLevel | null;
  exploreRun?: ExploreRun | null;
}

/**
 * Orchestrates one lesson: reads the abstracted input, drives the player
 * controller, runs physics/collisions, reacts to level events through the bus
 * and renders the world plus HUD.
 *
 * It is the only place that connects input -> gameplay -> rules, which keeps
 * every one of those pieces independent and testable.
 */
export class GameScene extends Scene {
  physics = new PhysicsEngine();
  private _unsubscribers: Array<() => void> = [];

  mode: 'normal' | 'speedrun' | 'explore' = 'normal';

  mistakes = 0;
  status: StatusValue = Status.RUNNING;
  private _winTimer = 0;
  private _gameOverJumpGesture = new JumpConfirmGesture();

  level!: GameLevel;
  lesson!: Lesson;
  validator!: AnswerValidator;
  levelManager!: LevelManager;
  lives!: LivesManager;
  player!: PlayerController;
  camera!: Camera;
  hudModel!: HudModel;
  character: ReturnType<typeof getCharacter> | null = null;

  /** Progress through the A-to-Z run; null outside speedrun mode. */
  speedrun: SpeedrunRun | null = null;
  /** Progress through one Explorar session; null outside explore mode. */
  exploreRun: ExploreRun | null = null;

  get speedrunCheckpoints(): Point[] | undefined {
    return this.speedrun?.checkpoints;
  }

  get alphabet(): string[] | undefined {
    return this.speedrun?.alphabet;
  }

  get currentIndex(): number {
    return this.speedrun?.currentIndex ?? 0;
  }

  set currentIndex(index: number) {
    if (this.speedrun) this.speedrun.currentIndex = index;
  }

  get speedrunElapsed(): number {
    return this.speedrun?.elapsed ?? 0;
  }

  set speedrunElapsed(seconds: number) {
    if (this.speedrun) this.speedrun.elapsed = seconds;
  }

  override enter({
    lessonId,
    mode = 'normal',
    speedrunCourse = null,
    speedrunState = null,
    exploreCourse = null,
    exploreRun = null,
  }: EnterParams = {}): void {
    this.mode = mode;
    this.mistakes = 0;
    this.status = Status.RUNNING;
    this._winTimer = 0;
    this.speedrun = null;
    this.exploreRun = null;

    if (this.mode === 'speedrun') {
      const course = speedrunCourse ?? (buildSpeedrunCourse() as unknown as GameLevel);
      this.level = course;
      this.speedrun = new SpeedrunRun(course.alphabet ?? [], course.checkpoints, speedrunState?.elapsed ?? 0);

      this.lesson = this._letterLesson(this.speedrun.currentLetter, 0);
      this.validator = new AnswerValidator(this.lesson);
    } else if (this.mode === 'explore') {
      const course =
        exploreCourse ?? (buildExploreCourse(WORD_BANK.slice(0, 6)) as unknown as GameLevel);
      this.level = course;
      this.exploreRun =
        exploreRun ?? new ExploreRun((course.words as never) ?? WORD_BANK.slice(0, 6), course.checkpoints);

      this.lesson = this._letterLesson(this.exploreRun.currentLetter, 0);
      this.validator = new AnswerValidator(this.lesson);
    } else {
      const lesson = this.game.curriculum.getLesson(lessonId);
      if (!lesson) throw new Error(`Unknown lesson: ${lessonId}`);
      const levelData = getLevelData(lesson.levelId);
      if (!levelData) throw new Error(`Missing level file for lesson ${lessonId}`);

      this.lesson = lesson;
      this.level = loadLevel(levelData) as unknown as GameLevel;
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
      viewport: this.level.viewport as never,
      maxX: this.level.camera.maxX,
      startX: this.level.camera.startX,
      smoothing: this.level.camera.smoothing,
    });
    this.camera.snapTo(this.player.body);

    const isSpeedrun = this.mode === 'speedrun';
    const isExplore = this.mode === 'explore';
    const progressText = this.speedrun?.progressText ?? this.exploreRun?.progressText ?? '';
    const objective = isExplore
      ? `Monte a palavra: ${this.exploreRun!.currentWord.label}`
      : this.lesson.objective;

    this.hudModel = new HudModel({
      objective,
      levelName: this.level.name,
      lives: this.lives.lives,
      maxLives: this.lives.maxLives,
      isSpeedrun: isSpeedrun || isExplore,
      showTimer: isSpeedrun,
      timer: this.speedrunElapsed,
      speedrunProgress: progressText,
    });
    if (this.exploreRun) this._syncExploreBoard(this.exploreRun);
    this.character = getCharacter(this.game.profiles.getActiveProfile()?.characterId);
    // Fire-and-forget like the boot preload: until the images land, SpriteRenderer
    // draws its solid-colour / placeholder fallbacks instead of blocking the level.
    this.game.assets?.load(lessonAssets(this.level, this.character)).catch((error) => {
      console.warn('Lesson art failed to load; falling back to placeholder shapes.', error);
    });

    this.game.sprites.setLevel(this.level);
    this._subscribe();
    this.game.hudControls.showPauseButton({ onPause: () => this.togglePause() });
    if (this.game.device?.isTouch) this.game.touchControls.show();
    this.game.bus.emit(Events.LESSON_STARTED, { lesson: this.lesson });
    tryLockLandscape().catch(() => {});
    // Explorar narrates on touching each word's discovery marker instead of
    // announcing the letter target up front — the word hasn't been found yet.
    if (this.lesson?.target && this.mode !== 'explore') {
      this.game.narrator?.speakLessonTarget(this.lesson.target, this.lesson.type);
    }
  }

  /** The alphabet lesson for `letter`, or an equivalent stand-in when the curriculum lacks it. */
  private _letterLesson(letter: string, index: number): Lesson {
    const id = `alfabeto-${letter.toLowerCase()}`;
    return (
      this.game.curriculum?.getLesson?.(id) ?? {
        id,
        unitId: 'alfabeto',
        unitTitle: 'Alfabeto',
        type: 'letter',
        target: letter,
        variants: [letter],
        objective: `Colete a letra ${letter}`,
        levelId: id,
        index,
      }
    );
  }

  override exit(): void {
    if (this.status !== Status.WON) {
      this.game.narrator?.stop();
    }
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    this._unsubscribers = [];
    this.game.menu.hide();
    this.game.hudControls.hidePauseButton();
    this.game.touchControls.hide();
    this.game.effects.clear();
  }

  override update(dt: number): void {
    if (this.game.input.consumePressed(Actions.DEBUG)) {
      this.game.debug.toggle();
    }
    if (this.game.input.consumePressed(Actions.PAUSE)) {
      this.togglePause();
    }

    if (this.status === Status.GAME_OVER) {
      // Same primary/back triggers the victory screen already has, plus the
      // phone's single-jump-confirms / double-jump-back gesture — until now
      // this branch never consumed CONFIRM/BACK at all, so only a mouse
      // click on "Tentar de novo"/"Menu" ever worked here.
      pumpOverlayInput(this.game, this._gameOverJumpGesture);
      return;
    }
    if (this.status === Status.PAUSED) {
      // Fixes the same gap as GAME_OVER above (CONFIRM/BACK never reached the
      // overlay, only mouse clicks did). Deliberately NOT wiring the phone's
      // jump gesture here: the pause menu's "confirm" step is a destructive
      // action (restart/quit, losing progress) sharing the same primary
      // button as its own screen — a stray jump from a phone still strapped
      // on while paused shouldn't be able to trigger that.
      pumpMenuKeys(this.game);
      return;
    }

    if (this.mode === 'speedrun') {
      this.speedrun?.tick(dt);
      this.hudModel.setTimer(this.speedrunElapsed);
    } else if (this.mode === 'explore') {
      // No visible clock for Explorar (showTimer: false); ticked anyway so the
      // future-item hint keeps its normal pacing, same as speedrun's.
      this.exploreRun?.tick(dt);
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

  override draw(renderer: CanvasRenderer): void {
    this.game.sprites.drawBackground(renderer, this.camera?.x ?? 0);
    renderer.setCamera(this.camera.x, this.camera.y);
    this.game.sprites.drawTerrain(renderer);
    this.game.sprites.drawObjects(
      renderer,
      this.level,
      this.mode === 'speedrun'
        ? (this.speedrunCheckpoints ?? null)
        : this.mode === 'explore'
          ? (this.level.checkpoints ?? null)
          : null,
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
  private _applyInput(): void {
    const axis = this.game.input.getMoveAxis();
    if (axis < 0) this.player.moveLeft();
    else if (axis > 0) this.player.moveRight();
    else this.player.stop();

    if (this.game.input.consumePressed(Actions.JUMP)) {
      this.player.jump();
      vibrateJump();
    }
    this.player.holdJump(this.game.input.isActionHeld(Actions.JUMP));
  }

  // --- Event reactions ------------------------------------------------------

  private _subscribe(): void {
    const on = <T,>(event: string, handler: (payload: T) => void) =>
      this._unsubscribers.push(this.game.bus.on(event as never, handler as never));

    on<{ item: LevelItem }>(Events.ITEM_COLLECTED, ({ item }) => this.onItemCollected(item));
    on(Events.HAZARD_HIT, () => this.onHazardHit());
    on(Events.PLAYER_FELL, () => this.respawn());
    on<{ lives: number; maxLives: number }>(Events.LIVES_CHANGED, ({ lives, maxLives }) => {
      this.hudModel.setLives(lives);
      this.hudModel.maxLives = maxLives;
    });
    on(Events.LIVES_DEPLETED, () => this.onGameOver());
    on(Events.APP_BLURRED, () => this.pause());
  }

  onItemCollected(
    item: LevelItem & { segmentIndex?: number; label?: string; kind?: string; fact?: string },
  ): void {
    if (this.status !== Status.RUNNING) return;

    // The discovery marker is a narration trigger, not a right/wrong pickup:
    // no validator, no mistake tracking, no lesson-answer recording.
    if (this.mode === 'explore' && item.kind === 'discovery') {
      this.game.narrator?.speak(`${item.label}. ${item.fact ?? ''}`.trim());
      this.exploreRun?.markDiscovered();
      return;
    }

    if (this.speedrun?.isAhead(item)) {
      this.levelManager.collected.delete(item.id);
      if (this.speedrun.claimFutureHint()) {
        this.hudModel.showFeedback(
          FeedbackKind.WRONG,
          `Essa letra vem mais à frente! Procure a letra "${this.lesson.target}".`,
          FUTURE_HINT_INTERVAL,
        );
      }
      return;
    }

    if (this.exploreRun?.isAhead(item)) {
      this.levelManager.collected.delete(item.id);
      if (this.exploreRun.claimFutureHint()) {
        const hint = this.exploreRun.discovered
          ? `Essa letra vem mais à frente! Procure a letra "${this.lesson.target}".`
          : `Toque em "${this.exploreRun.currentWord.label}" primeiro!`;
        this.hudModel.showFeedback(FeedbackKind.WRONG, hint, EXPLORE_FUTURE_HINT_INTERVAL);
      }
      return;
    }

    const { ok } = this.validator.validate(item);
    const centerX = item.x + item.w / 2;
    const centerY = item.y + item.h / 2;
    const profile = this.game.profiles.getActiveProfile();

    if (profile) this.game.progress.recordLessonAnswer(profile.id, this.lesson.id, ok, item.label);

    if (ok) {
      this._handleCorrectAnswer(item, profile, centerX, centerY);
      return;
    }

    this._handleWrongAnswer(item, profile, centerX, centerY);
  }

  /** Correct-answer flow: record, celebrate, then advance (speedrun) or win (normal). */
  private _handleCorrectAnswer(
    item: LevelItem,
    profile: { id: string } | null,
    centerX: number,
    centerY: number,
  ): void {
    if (profile) this.game.progress.recordAnswer(profile.id, true);
    this.game.effects.spawnConfetti(centerX, centerY, 56);
    this.game.effects.spawnFloatingText?.(centerX, centerY - 25, '+10 Muito bem!', '#ffd479');
    vibrateCollect();
    this.game.narrator?.speakPraise();

    if (this.speedrun) {
      this._advanceSpeedrun(this.speedrun);
      return;
    }

    if (this.exploreRun) {
      this._advanceExplore(this.exploreRun);
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
  private _advanceSpeedrun(run: SpeedrunRun): void {
    if (run.advance()) {
      const nextLetter = run.currentLetter;
      this.lesson = this._letterLesson(nextLetter, run.currentIndex);
      this.validator = new AnswerValidator(this.lesson);
      if (run.currentCheckpoint) {
        this.levelManager.setCheckpoint({ ...run.currentCheckpoint });
      }

      this.hudModel.setObjective(this.lesson.objective ?? '');
      this.hudModel.setSpeedrunProgress(run.progressText);
      this.hudModel.showFeedback(
        FeedbackKind.CORRECT,
        `Boa! Agora letra ${nextLetter}!`,
        0.8,
      );
      this.game.narrator?.speakLessonTarget(nextLetter, 'letter');
      // Continuous! The player does NOT stop, does NOT reload scene, keeps running!
      return;
    }

    // Collected Z! Venceu a maratona!
    this.hudModel.showFeedback(FeedbackKind.CORRECT, 'Parabéns! Maratona concluída!', 1.5);
    this.winLevel();
  }

  private _syncExploreBoard(run: ExploreRun): void {
    this.hudModel.setWordBoard(run.currentWordLetters, run.currentLetterIndex);
  }

  /** Explore advance: next letter of the same word, the next word, or session victory. */
  private _advanceExplore(run: ExploreRun): void {
    const wordComplete = run.collectLetter();
    this._syncExploreBoard(run);

    if (!wordComplete) {
      const nextLetter = run.currentLetter;
      this.lesson = this._letterLesson(nextLetter, run.currentWordIndex);
      this.validator = new AnswerValidator(this.lesson);
      this.hudModel.showFeedback(FeedbackKind.CORRECT, 'Boa! Continue!', 0.6);
      return;
    }

    const profile = this.game.profiles.getActiveProfile();
    if (profile) this.game.progress.recordDiscovery(profile.id, run.currentWord.id);
    const completedWord = run.currentWord.label;

    if (run.advance()) {
      const nextLetter = run.currentLetter;
      this.lesson = this._letterLesson(nextLetter, run.currentWordIndex);
      this.validator = new AnswerValidator(this.lesson);
      if (run.currentCheckpoint) {
        this.levelManager.setCheckpoint({ ...run.currentCheckpoint });
      }

      this.hudModel.setObjective(`Monte a palavra: ${run.currentWord.label}`);
      this.hudModel.setSpeedrunProgress(run.progressText);
      this._syncExploreBoard(run);
      this.hudModel.showFeedback(FeedbackKind.CORRECT, `Você descobriu ${completedWord}!`, 1.2);
      return;
    }

    // Last word spelled — session complete!
    this.hudModel.showFeedback(FeedbackKind.CORRECT, `Você descobriu ${completedWord}! Parabéns!`, 1.5);
    this.winLevel();
  }

  /** Wrong-answer flow: count the mistake, cost a heart, show guidance. */
  private _handleWrongAnswer(
    item: LevelItem & { label?: string },
    profile: { id: string } | null,
    centerX: number,
    centerY: number,
  ): void {
    this.mistakes += 1;
    if (profile) this.game.progress.recordAnswer(profile.id, false);
    this.lives.loseHeart();
    vibrateWarning();
    this.game.effects.spawnPuff(centerX, centerY, 14, '#ff5d73');
    this.game.effects.spawnFloatingText?.(centerX, centerY - 20, 'Ops!', '#ff5d73');
    this.hudModel.showFeedback(
      FeedbackKind.WRONG,
      `Ops! Esse era "${item.label}". Procure "${this.lesson.target}".`,
      GAMEPLAY.wrongFeedbackDuration,
    );
    if (item.label) {
      const kind = this.lesson.type === 'word' ? 'palavra' : this.lesson.type === 'syllable' ? 'sílaba' : 'letra';
      this.game.narrator?.speak(`Essa é a ${kind} ${item.label.toLowerCase()}. Procure ${this.lesson.target.toLowerCase()}.`);
    }
  }

  onHazardHit(): void {
    this.lives.loseHeart();
    vibrateWarning();
    this.hudModel.showFeedback(
      FeedbackKind.WRONG,
      'Ai! Cuidado!',
      GAMEPLAY.wrongFeedbackDuration,
    );
    this.respawn();
  }

  /** Falling costs no heart — the player just returns to the checkpoint. */
  respawn(): void {
    this.player.reset(this.levelManager.getRespawnPoint());
    this.levelManager.resetTransientState();
    this.camera.snapTo(this.player.body);
    this.game.effects.clear();
  }

  winLevel(): void {
    this.status = Status.WON;
    vibrateVictory();
    if (this.mode === 'speedrun' || this.mode === 'explore') {
      this.game.narrator?.speakPraise('Parabéns!');
    }
    this._winTimer = this.mode === 'speedrun' || this.mode === 'explore' ? 1.2 : GAMEPLAY.celebrationDuration;
    this.game.effects.spawnConfetti(
      this.player.body.x + this.player.body.w / 2,
      this.player.body.y,
      96,
    );
  }

  finishLevel(): void {
    const profile = this.game.profiles.getActiveProfile();

    if (this.mode === 'speedrun') {
      const elapsed = this.speedrunElapsed;
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

    if (this.mode === 'explore') {
      this.game.scenes.switchTo('victory', {
        mode: 'explore',
        words: this.exploreRun?.words.map((word) => word.label) ?? [],
        mistakes: this.mistakes,
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

  onGameOver(): void {
    this.status = Status.GAME_OVER;
    this._gameOverJumpGesture.reset();
    this.game.menu.showGameOver({
      lesson: this.lesson,
      onRetry: () => this.restart(),
      onMenu: () => this.game.scenes.switchTo('menu'),
    });
  }

  /** Starts this run over: a fresh speedrun/explore session, or the current lesson from the top. */
  restart(): void {
    if (this.mode === 'speedrun') {
      this.game.startSpeedrun();
    } else if (this.mode === 'explore') {
      this.game.startExploration();
    } else {
      this.game.scenes.switchTo('game', { lessonId: this.lesson.id });
    }
  }

  // --- Pause ----------------------------------------------------------------

  togglePause(): void {
    if (this.status === Status.PAUSED) this.resume();
    else this.pause();
  }

  pause(): void {
    if (this.status !== Status.RUNNING) return;
    this.status = Status.PAUSED;
    this.game.input.reset();
    this._showPauseMenu();
  }

  private _showPauseMenu(): void {
    this.game.menu.showPause({
      isSpeedrun: this.mode === 'speedrun',
      isMuted: this.game.audio.isMuted,
      onResume: () => this.resume(),
      onRestart: () => this.restart(),
      onMenu: () => this.game.scenes.switchTo('menu'),
      onToggleMute: () => {
        this.game.audio.toggleMuted();
        this._showPauseMenu();
      },
      isPhoneControlActive: this.game.phoneControl.isActive,
      onDisablePhoneControl: () => {
        // Dropping input source mid-game isn't destructive to progress like
        // restart/menu are, so no confirm step — just switch back to
        // keyboard/touch and let the parent keep playing right away.
        this.game.phoneControl.stop();
        this.resume();
      },
    });
  }

  resume(): void {
    if (this.status !== Status.PAUSED) return;
    this.status = Status.RUNNING;
    this.game.menu.hide();
    // Clear held keys so the player does not keep running after resuming.
    this.game.input.reset();
    // Let an adapter with no physical key/touch behind it (AutoRunAdapter,
    // in phone-control mode) re-assert its own state — reset() above just
    // cleared it, and nothing else will ever re-press it.
    this.game.input.resync();
  }
}
