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
import { getCharacter } from '../content/characters.js';
import { Camera } from '../render/camera.js';
import { lessonAssets } from '../render/asset-plan.js';
import { FeedbackKind, HudModel } from '../render/hud-model.js';
import { SpeedrunRun } from '../gameplay/speedrun-run.js';
import { ALPHABET, createExploreStream, createLessonStream, createSpeedrunStream } from '../gameplay/stream-courses.js';
import { PORTAL_SIZE, type WorldStream } from '../gameplay/world-stream.js';
import { ExploreRun } from '../gameplay/explore-run.js';
import { WORD_BANK } from '../content/word-bank.js';
import { wordPhaseId, wordPhasePosition } from '../content/word-phases.js';
import type { CanvasRenderer } from '../render/canvas-renderer.js';
import type { Lesson } from '../content/curriculum-model.js';
import { vibrateJump, vibrateCollect, vibrateVictory, vibrateWarning } from '../input/haptics.js';
import { tryLockLandscape } from '../ui/orientation.js';
import { pumpMenuKeys, pumpOverlayInput } from '../ui/overlay-input.js';

/** Portal exit timeline (seconds): the player is swallowed, then the screen whitens into the victory. */
const PORTAL_SWALLOW_AT = 0.55;
const PORTAL_WIN_SECONDS = 1.7;

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
  worldWidth: number;
}

interface EnterParams {
  lessonId?: string;
  mode?: 'normal' | 'speedrun' | 'explore';
  speedrunState?: { elapsed?: number } | null;
  exploreRun?: ExploreRun | null;
  /** Injects the endless world (tests use it for a deterministic layout); built per mode when omitted. */
  stream?: WorldStream | null;
  /** Word (bank id) for an Explorar phase; defaults to the first word of the bank. */
  wordId?: string;
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
  private _winElapsed = 0;
  private _winViaPortal = false;
  private _playerHidden = false;
  private _shake = 0;
  /** True once the last target is collected: the world is sealed and the portal is the only way out. */
  portalOpen = false;
  private _terrainVersion = -1;
  private _gameOverJumpGesture = new JumpConfirmGesture();

  stream!: WorldStream;
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
    speedrunState = null,
    exploreRun = null,
    stream = null,
    wordId,
  }: EnterParams = {}): void {
    this.mode = mode;
    this.mistakes = 0;
    this.status = Status.RUNNING;
    this._winTimer = 0;
    this._winElapsed = 0;
    this._winViaPortal = false;
    this._playerHidden = false;
    this._shake = 0;
    this.portalOpen = false;
    this._terrainVersion = -1;
    this.speedrun = null;
    this.exploreRun = null;

    if (this.mode === 'speedrun') {
      this.stream = stream ?? createSpeedrunStream();
      this.speedrun = new SpeedrunRun(ALPHABET, undefined, speedrunState?.elapsed ?? 0);

      this.lesson = this._letterLesson(this.speedrun.currentLetter, 0);
      this.validator = new AnswerValidator(this.lesson);
    } else if (this.mode === 'explore') {
      const word = exploreRun?.word ?? WORD_BANK.find((entry) => entry.id === wordId) ?? WORD_BANK[0];
      this.stream = stream ?? createExploreStream(word);
      this.exploreRun = exploreRun ?? new ExploreRun(word, wordPhasePosition(wordPhaseId(word.id)));

      this.lesson = this._letterLesson(this.exploreRun.currentLetter, 0);
      this.validator = new AnswerValidator(this.lesson);
    } else {
      const lesson = this.game.curriculum.getLesson(lessonId);
      if (!lesson) throw new Error(`Unknown lesson: ${lessonId}`);
      this.lesson = lesson;
      this.stream = stream ?? createLessonStream(lesson);
      this.validator = new AnswerValidator(lesson);
    }

    this.level = this.stream.level as unknown as GameLevel;
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

    this._syncTerrain();
    this._subscribe();
    this.game.hudControls.showPauseButton({ onPause: () => this.togglePause() });
    if (this.game.device?.isTouch) this.game.touchControls.show();
    this.game.bus.emit(Events.LESSON_STARTED, { lesson: this.lesson });
    tryLockLandscape().catch(() => {});
    if (this.exploreRun) {
      this.game.narrator?.speakWordTarget(this.exploreRun.word.label);
    } else if (this.lesson?.target) {
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
      this._winElapsed += dt;
      if (this._winViaPortal) this._updatePortalEntry(dt);
      this.game.effects.update(dt);
      this.hudModel.update(dt);
      if (this._winTimer <= 0) this.finishLevel();
      return;
    }

    this._applyInput();
    this.player.update(dt, this.level);
    this.levelManager.update(this.player);
    this._updateStream(dt);
    this.camera.follow(this.player.body);
    this._shake = Math.max(0, this._shake - dt);
    this.hudModel.update(dt);
    this.game.effects.update(dt);
  }

  /** Keeps the endless world generated ahead of the player and the respawn point on their segment. */
  private _updateStream(dt: number): void {
    this.stream.update(this.player.body.x);
    this.stream.tick(dt);

    const checkpoint = this.stream.checkpointFor(this.player.body.x);
    if (checkpoint.x !== this.levelManager.getRespawnPoint().x) this.levelManager.setCheckpoint(checkpoint);
    this._syncTerrain();
  }

  /** The renderer caches grass strips per terrain; refresh them whenever the stream added or dropped ground. */
  private _syncTerrain(): void {
    if (this._terrainVersion === this.stream.terrainVersion) return;
    this._terrainVersion = this.stream.terrainVersion;
    this.game.sprites.setLevel(this.level);
    this.camera.maxX = this.level.camera.maxX;
  }

  /** The portal pops into being, already on screen: ring, sparkles, label and a short shake. */
  private _playPortalIntro(finish: Point): void {
    const cx = finish.x + PORTAL_SIZE.w / 2;
    const cy = finish.y + PORTAL_SIZE.h / 2;
    this.game.effects.spawnRing(cx, cy, 36);
    this.game.effects.spawnPuff(cx, cy, 20, '#b9f2ff');
    this.game.effects.spawnFloatingText?.(cx, finish.y - 14, 'Portal!', '#b9f2ff');
    this._shake = 0.35;
  }

  /** Portal entry: the player is drawn into the portal, then a burst and a white flash close the phase. */
  private _updatePortalEntry(dt: number): void {
    const finish = this.level.finish;
    if (!finish) return;
    const body = this.player.body;
    const targetX = finish.x + PORTAL_SIZE.w / 2 - body.w / 2;
    const targetY = finish.y + PORTAL_SIZE.h / 2 - body.h / 2;
    const pull = Math.min(1, dt * 7);
    body.x += (targetX - body.x) * pull;
    body.y += (targetY - body.y) * pull;

    if (!this._playerHidden && this._winElapsed >= PORTAL_SWALLOW_AT) {
      this._playerHidden = true;
      const cx = finish.x + PORTAL_SIZE.w / 2;
      const cy = finish.y + PORTAL_SIZE.h / 2;
      this.game.effects.spawnRing(cx, cy, 36, '#ffffff', 280);
      this.game.effects.spawnConfetti(cx, cy, 120);
      this._shake = 0.4;
    }
  }

  /** 0 -> 1 white overlay over the end of the portal exit. */
  private get _flashAlpha(): number {
    if (!this._winViaPortal) return 0;
    const fadeStart = PORTAL_SWALLOW_AT + 0.2;
    return Math.min(1, Math.max(0, (this._winElapsed - fadeStart) / (PORTAL_WIN_SECONDS - fadeStart)));
  }

  override draw(renderer: CanvasRenderer): void {
    this.game.sprites.drawBackground(renderer, this.camera?.x ?? 0);
    const shake = this._shake > 0 ? this._shake * 14 : 0;
    renderer.setCamera(
      this.camera.x + (shake ? (Math.random() - 0.5) * shake : 0),
      this.camera.y + (shake ? (Math.random() - 0.5) * shake : 0),
    );
    this.game.sprites.drawTerrain(renderer);
    // The single checkpoint flag follows the player's segment.
    this.game.sprites.drawObjects(renderer, this.level, [this.levelManager.getRespawnPoint()]);
    this.game.sprites.drawItems(renderer, this.level.items, this.levelManager.collected);
    this.game.sprites.drawHazards(renderer, this.level.hazards);
    if (!this._playerHidden) this.game.sprites.drawPlayer(renderer, this.player, this.character);
    this.game.effects.draw(renderer);

    const flash = this._flashAlpha;
    if (flash > 0) {
      renderer.setCamera(0, 0);
      renderer.screenFillRect(0, 0, renderer.width, renderer.height, `rgba(255, 255, 255, ${flash})`);
    }

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
    on(Events.PORTAL_ENTERED, () => this.onPortalEntered());
    on(Events.PLAYER_FELL, () => this.respawn());
    on<{ lives: number; maxLives: number }>(Events.LIVES_CHANGED, ({ lives, maxLives }) => {
      this.hudModel.setLives(lives);
      this.hudModel.maxLives = maxLives;
    });
    on(Events.LIVES_DEPLETED, () => this.onGameOver());
    on(Events.APP_BLURRED, () => this.pause());
  }

  onItemCollected(item: LevelItem & { label?: string; kind?: string; fact?: string }): void {
    if (this.status !== Status.RUNNING) return;

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
    this._openPortal();
  }

  /** Speedrun advance: next letter checkpoint, or marathon victory on Z. */
  private _advanceSpeedrun(run: SpeedrunRun): void {
    if (run.advance()) {
      const nextLetter = run.currentLetter;
      this.lesson = this._letterLesson(nextLetter, run.currentIndex);
      this.validator = new AnswerValidator(this.lesson);
      this.stream.setTarget(nextLetter, this.player.body.x);

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

    // Collected Z! Only the portal is left.
    this.hudModel.showFeedback(FeedbackKind.CORRECT, 'Z! Corra até o portal!', 1.5);
    this._openPortal();
  }

  private _syncExploreBoard(run: ExploreRun): void {
    this.hudModel.setWordBoard(run.currentWordLetters, run.currentLetterIndex);
  }

  /** Explore advance: next letter of the word, or phase victory once it is spelled. */
  private _advanceExplore(run: ExploreRun): void {
    const wordComplete = run.collectLetter();
    this._syncExploreBoard(run);

    if (!wordComplete) {
      this.lesson = this._letterLesson(run.currentLetter, run.currentLetterIndex);
      this.validator = new AnswerValidator(this.lesson);
      this.stream.setTarget(run.currentLetter, this.player.body.x);
      this.hudModel.showFeedback(FeedbackKind.CORRECT, 'Boa! Continue!', 0.6);
      return;
    }

    this.hudModel.showFeedback(FeedbackKind.CORRECT, `Você montou ${run.word.label}! Corra até o portal!`, 1.5);
    this._openPortal();
  }

  /** Last target collected: seal the world with an arrival stretch and the portal; the phase ends only inside it. */
  private _openPortal(): void {
    if (this.portalOpen) return;
    this.portalOpen = true;
    const finish = this.stream.spawnPortal(this.player.body.x);
    this._syncTerrain();
    this._playPortalIntro(finish);
    this.hudModel.setObjective('Corra até o portal!');
    this.game.narrator?.speak?.('O portal abriu! Corra até ele!');
  }

  onPortalEntered(): void {
    if (this.status !== Status.RUNNING || !this.portalOpen) return;
    this.winLevel({ viaPortal: true });
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

  winLevel({ viaPortal = false }: { viaPortal?: boolean } = {}): void {
    this.status = Status.WON;
    this._winElapsed = 0;
    this._winViaPortal = viaPortal;
    vibrateVictory();
    if (this.mode === 'speedrun' || this.mode === 'explore') {
      this.game.narrator?.speakPraise('Parabéns!');
    }
    const centerX = this.player.body.x + this.player.body.w / 2;
    if (viaPortal) {
      // The suction pulls the player in; the burst and the flash follow (see _updatePortalEntry).
      this._winTimer = PORTAL_WIN_SECONDS;
      this.game.effects.spawnSuction(centerX, this.player.body.y + this.player.body.h / 2);
      return;
    }
    this._winTimer = this.mode === 'speedrun' || this.mode === 'explore' ? 1.2 : GAMEPLAY.celebrationDuration;
    this.game.effects.spawnConfetti(centerX, this.player.body.y, 96);
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

    if (this.mode === 'explore' && this.exploreRun) {
      if (profile) this.game.progress.recordDiscovery(profile.id, this.exploreRun.word.id);
      const entry = profile
        ? this.game.progress.completeLesson(profile.id, wordPhaseId(this.exploreRun.word.id), {
            mistakes: this.mistakes,
          })
        : null;
      this.game.scenes.switchTo('victory', {
        mode: 'explore',
        wordId: this.exploreRun.word.id,
        mistakes: this.mistakes,
        stars: entry?.stars ?? 0,
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

  /** Starts this run over: a fresh speedrun, the same Explorar word, or the current lesson from the top. */
  restart(): void {
    if (this.mode === 'speedrun') {
      this.game.startSpeedrun();
    } else if (this.mode === 'explore') {
      this.game.startExploration(this.exploreRun?.word.id);
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
