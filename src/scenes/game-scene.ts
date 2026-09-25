import { Scene } from '../core/scene.js';
import { Actions } from '../input/actions.js';
import { JumpConfirmGesture } from '../input/jump-confirm-gesture.js';
import { Events } from '../core/event-bus.js';
import { GAMEPLAY, PORTAL_SIZE } from '../core/config.js';
import { PhysicsEngine } from '../physics/physics-engine.js';
import { PlayerController } from '../gameplay/player/player-controller.js';
import { LivesManager } from '../gameplay/lives-manager.js';
import { LevelManager, type LevelItem, type Point } from '../gameplay/level-manager.js';
import { AnswerValidator } from '../content/answer-validator.js';
import { getCharacter } from '../content/characters.js';
import { Camera } from '../render/camera.js';
import { lessonAssets } from '../render/asset-plan.js';
import { FeedbackKind, HudModel } from '../render/hud-model.js';
import { SpeedrunRun } from '../gameplay/speedrun-run.js';
import { ALPHABET, createExploreStream, createLessonStream, createSpeedrunStream } from '../gameplay/stream-courses.js';
import type { StreamItem, StreamLevel, WorldStream } from '../gameplay/world-stream.js';
import { JOURNEY_LENGTH, journeyWords } from '../content/discoveries.js';
import { ExploreRun } from '../gameplay/explore-run.js';
import { supportPolicy, type SupportPolicy } from '../gameplay/support-policy.js';
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
/** Reduced motion: no suction, burst or flash — the player just steps in and the phase closes. */
const PORTAL_WIN_SECONDS_CALM = 0.9;

const Status = Object.freeze({
  RUNNING: 'running',
  PAUSED: 'paused',
  WON: 'won',
  GAME_OVER: 'gameOver',
});

type StatusValue = (typeof Status)[keyof typeof Status];

type FeedbackKindValue = (typeof FeedbackKind)[keyof typeof FeedbackKind];

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
  private _winCalm = false;
  /** Set once `finishLevel` ran: results are recorded and the victory shown exactly once. */
  private _finished = false;
  private _playerHidden = false;
  private _shake = 0;
  /** True once the last target is collected: the world is sealed and the portal is the only way out. */
  portalOpen = false;
  private _terrainVersion = -1;
  private _gameOverJumpGesture = new JumpConfirmGesture();
  /** Seconds since the last correct answer (or repeated instruction), for assisted auto-repeat. */
  private _sinceProgress = 0;

  stream!: WorldStream;
  level!: StreamLevel;
  lesson!: Lesson;
  validator!: AnswerValidator;
  levelManager!: LevelManager;
  lives!: LivesManager;
  player!: PlayerController;
  camera!: Camera;
  hudModel!: HudModel;
  character: ReturnType<typeof getCharacter> | null = null;
  /** What the "Nível de apoio" setting changes in this run; read once at entry. */
  support: SupportPolicy = supportPolicy('standard');

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

  private get _reducedMotion(): boolean {
    return this.game.preferences?.reducedMotion() ?? false;
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
    this._winCalm = false;
    this._finished = false;
    this._playerHidden = false;
    this._shake = 0;
    this._sinceProgress = 0;
    this.portalOpen = false;
    this._terrainVersion = -1;
    this.speedrun = null;
    this.exploreRun = null;
    this.support = supportPolicy(this.game.preferences?.supportLevel());
    const { distractorsPerSegment, allowNeighbourLetters } = this.support;

    if (this.mode === 'speedrun') {
      this.stream = stream ?? createSpeedrunStream({ distractorsPerSegment, allowNeighbourLetters });
      this.speedrun = new SpeedrunRun(ALPHABET, undefined, speedrunState?.elapsed ?? 0);

      this.lesson = this._letterLesson(this.speedrun.currentLetter, 0);
      this.validator = new AnswerValidator(this.lesson);
    } else if (this.mode === 'explore') {
      const word = exploreRun?.word ?? WORD_BANK.find((entry) => entry.id === wordId) ?? WORD_BANK[0];
      this.stream = stream ?? createExploreStream(word, { distractorsPerSegment });
      this.exploreRun = exploreRun ?? new ExploreRun(word, wordPhasePosition(wordPhaseId(word.id)));

      this.lesson = this._letterLesson(this.exploreRun.currentLetter, 0);
      this.validator = new AnswerValidator(this.lesson);
    } else {
      const lesson = this.game.curriculum.getLesson(lessonId);
      if (!lesson) throw new Error(`Unknown lesson: ${lessonId}`);
      this.lesson = lesson;
      this.stream = stream ?? createLessonStream(lesson, { distractorsPerSegment });
      this.validator = new AnswerValidator(lesson);
    }

    this.level = this.stream.level;
    this.levelManager = new LevelManager({ level: this.level, bus: this.game.bus });
    this.lives = new LivesManager({ lives: GAMEPLAY.startingLives, bus: this.game.bus });

    this.player = new PlayerController({
      x: this.level.playerStart.x,
      y: this.level.playerStart.y,
      physics: this.physics,
    });
    this.camera = new Camera({
      viewport: this.level.viewport,
      minX: this.level.camera.minX,
      maxX: this.level.camera.maxX,
      startX: this.level.camera.startX,
      smoothing: this.level.camera.smoothing,
    });
    this.camera.snapTo(this.player.body);

    const isSpeedrun = this.mode === 'speedrun';
    const isExplore = this.mode === 'explore';
    const progressText = this.speedrun?.progressText ?? this.exploreRun?.progressText ?? '';

    this.hudModel = new HudModel({
      objective: '',
      levelName: this.level.name,
      lives: this.lives.lives,
      maxLives: this.lives.maxLives,
      isSpeedrun: isSpeedrun || isExplore,
      showTimer: isSpeedrun,
      timer: this.speedrunElapsed,
      speedrunProgress: progressText,
    });
    this.game.announcer?.reset();
    this._setObjective(isExplore ? `Monte a palavra: ${this.exploreRun!.currentWord.label}` : this.lesson.objective);
    if (this.exploreRun) this._syncExploreBoard(this.exploreRun);
    this.character = getCharacter(this.game.profiles.getActiveProfile()?.characterId);
    // Fire-and-forget like the boot preload: until the images land, SpriteRenderer
    // draws its solid-colour / placeholder fallbacks instead of blocking the level.
    this.game.assets?.load(lessonAssets(this.level, this.character)).catch((error) => {
      console.warn('Lesson art failed to load; falling back to placeholder shapes.', error);
    });

    this._syncTerrain();
    this._subscribe();
    this.game.hudControls.showPauseButton({
      onPause: () => this.togglePause(),
      onRepeat: () => this.repeatInstruction(),
      word: this.exploreRun?.word,
      journeyLabel: this.exploreRun ? `Palavra ${Math.min(JOURNEY_LENGTH, journeyWords(this.exploreRun.journey).length + 1)} de ${JOURNEY_LENGTH}` : undefined,
    });
    if (this.game.device?.isTouch) this.game.touchControls.show();
    this.game.bus.emit(Events.LESSON_STARTED, { lesson: this.lesson });
    tryLockLandscape().catch(() => {});
    if (this.exploreRun) {
      this.game.narrator?.speakWordTarget(this.exploreRun.word.label);
      if (this.support.narrateNextLetter) this._speakNextLetter(this.exploreRun.currentLetter);
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

    if (this.status === Status.WON) {
      // The clock stopped when the player entered the portal: the exit
      // animation never counts toward a record.
      this._winTimer -= dt;
      this._winElapsed += dt;
      if (this._winViaPortal) this._updatePortalEntry(dt);
      this.game.effects.update(dt);
      this.hudModel.update(dt);
      if (this._winTimer <= 0) this.finishLevel();
      return;
    }

    if (this.mode === 'speedrun') {
      this.speedrun?.tick(dt);
      this.hudModel.setTimer(this.speedrunElapsed);
    } else if (this.mode === 'explore') {
      this.exploreRun?.tick(dt);
    }
    this._tickAssistedRepeat(dt);

    this._applyInput();
    this.player.update(dt, this.level);
    this.levelManager.update(this.player);
    // A reaction above (hazard, last letter + portal, game over) may have ended the run this frame.
    if (this.status !== Status.RUNNING) return;
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
    this._popWithdrawn();

    const checkpoint = this.stream.checkpointFor(this.player.body.x);
    if (checkpoint.x !== this.levelManager.getRespawnPoint().x) this.levelManager.setCheckpoint(checkpoint);
    this._syncTerrain();
    this._updateTargetPointer();
  }

  /** The renderer caches grass strips per terrain; refresh them whenever the stream added or dropped ground. */
  private _syncTerrain(): void {
    if (this._terrainVersion === this.stream.terrainVersion) return;
    this._terrainVersion = this.stream.terrainVersion;
    this.game.sprites.setLevel(this.level);
    this.camera.minX = this.level.camera.minX;
    this.camera.maxX = this.level.camera.maxX;
    this.levelManager.pruneCollected();
  }

  /** Letters the stream withdrew (now-wrong distractors, the portal clearing the way) pop softly where visible. */
  private _popWithdrawn(): void {
    const left = this.camera.x;
    const right = left + this.camera.viewport.width;
    for (const item of this.stream.drainWithdrawn()) {
      if (this.levelManager.collected.has(item.id)) continue;
      if (item.x + item.w < left || item.x > right) continue;
      this.game.effects.spawnPuff(item.x + item.w / 2, item.y + item.h / 2, 10, '#ffffff');
    }
  }

  /** The uncollected target the player should be looking for, if any. */
  private get _pendingTarget(): StreamItem | undefined {
    const live = this.stream.liveTarget;
    return live && !this.levelManager.collected.has(live.id) ? live : undefined;
  }

  /** Assisted support: name the letter at the screen edge while it is off-screen. */
  private _updateTargetPointer(): void {
    const target = this.support.highlightTarget && !this.portalOpen ? this._pendingTarget : undefined;
    if (!target) {
      this.hudModel.setTargetPointer(null);
      return;
    }
    const left = this.camera.x;
    const right = left + this.camera.viewport.width;
    if (target.x > right) this.hudModel.setTargetPointer({ direction: 'right', label: target.label });
    else if (target.x + target.w < left) this.hudModel.setTargetPointer({ direction: 'left', label: target.label });
    else this.hudModel.setTargetPointer(null);
  }

  /** The portal pops into being, already on screen: ring, sparkles, label and a short shake. */
  private _playPortalIntro(finish: Point): void {
    const cx = finish.x + PORTAL_SIZE.w / 2;
    const cy = finish.y + PORTAL_SIZE.h / 2;
    this.game.effects.spawnRing(cx, cy, 36);
    this.game.effects.spawnPuff(cx, cy, 20, '#b9f2ff');
    this.game.effects.spawnFloatingText?.(cx, finish.y - 14, 'Portal!', '#b9f2ff');
    if (!this._reducedMotion) this._shake = 0.35;
  }

  /** Portal entry: the player is drawn into the portal, then a burst and a white flash close the phase. */
  private _updatePortalEntry(dt: number): void {
    const finish = this.level.finish;
    if (!finish) return;
    if (this._winCalm) {
      // Reduced motion: no pull, no burst, no shake — the player simply disappears into the portal.
      this._playerHidden = true;
      return;
    }
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

  /** 0 -> 1 white overlay over the end of the portal exit (never with reduced motion). */
  private get _flashAlpha(): number {
    if (!this._winViaPortal || this._winCalm) return 0;
    const fadeStart = PORTAL_SWALLOW_AT + 0.2;
    return Math.min(1, Math.max(0, (this._winElapsed - fadeStart) / (PORTAL_WIN_SECONDS - fadeStart)));
  }

  override draw(renderer: CanvasRenderer): void {
    this.game.sprites.drawBackground(renderer, this.camera?.x ?? 0);
    const shake = this._shake > 0 && !this._reducedMotion ? this._shake * 14 : 0;
    renderer.setCamera(
      this.camera.x + (shake ? (Math.random() - 0.5) * shake : 0),
      this.camera.y + (shake ? (Math.random() - 0.5) * shake : 0),
    );
    this.game.sprites.drawTerrain(renderer);
    // The single checkpoint flag follows the player's segment.
    this.game.sprites.drawObjects(renderer, this.level, [this.levelManager.getRespawnPoint()]);
    this.game.sprites.drawItems(renderer, this.level.items, this.levelManager.collected);
    this._drawTargetHighlight(renderer);
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

  /** Assisted support: an arrow (a shape, not only a colour) points down at the letter to find. */
  private _drawTargetHighlight(renderer: CanvasRenderer): void {
    if (!this.support.highlightTarget || this.portalOpen || this.status !== Status.RUNNING) return;
    const target = this._pendingTarget;
    if (!target) return;
    const bob = this._reducedMotion ? 0 : Math.sin(Date.now() / 200) * 4;
    const x = target.x + target.w / 2;
    const y = target.y - 26 + bob;
    renderer.worldText?.('▼', x, y + 2, { color: '#1b2430', font: 'bold 30px sans-serif' });
    renderer.worldText?.('▼', x, y, { color: '#ffd166', font: 'bold 26px sans-serif' });
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

  // --- HUD + screen reader ---------------------------------------------------

  private _setObjective(text: string): void {
    this.hudModel.setObjective(text ?? '');
    this.game.announcer?.announce(text ?? '');
  }

  private _showFeedback(kind: FeedbackKindValue, message: string, duration: number): void {
    this.hudModel.showFeedback(kind, message, duration);
    this.game.announcer?.announce(message);
  }

  // --- Narration --------------------------------------------------------------

  private _speakNextLetter(letter: string): void {
    this.game.narrator?.speak?.(`Agora a letra ${letter.toLowerCase()}`, { interrupt: false });
  }

  /** Speaks the current instruction again (the HUD's "Ouvir novamente" button, or assisted auto-repeat). */
  repeatInstruction(): void {
    if (this.status !== Status.RUNNING && this.status !== Status.PAUSED) return;
    this._sinceProgress = 0;
    const narrator = this.game.narrator;
    if (!narrator) return;
    if (this.portalOpen) {
      narrator.speak('Corra até o portal!');
      return;
    }
    if (this.exploreRun) {
      narrator.speakWordTarget(this.exploreRun.word.label);
      this._speakNextLetter(this.exploreRun.currentLetter);
      return;
    }
    narrator.speakLessonTarget(this.lesson.target, this.lesson.type);
  }

  private _tickAssistedRepeat(dt: number): void {
    const after = this.support.repeatInstructionAfter;
    if (after === null || this.portalOpen) return;
    this._sinceProgress += dt;
    if (this._sinceProgress >= after) this.repeatInstruction();
  }

  // --- Event reactions ------------------------------------------------------

  private _subscribe(): void {
    const bus = this.game.bus;
    this._unsubscribers.push(
      bus.on(Events.ITEM_COLLECTED, ({ item }) => this.onItemCollected(item)),
      bus.on(Events.HAZARD_HIT, () => this.onHazardHit()),
      bus.on(Events.PORTAL_ENTERED, () => this.onPortalEntered()),
      bus.on(Events.PLAYER_FELL, () => this.respawn()),
      bus.on(Events.LIVES_CHANGED, ({ lives, maxLives }) => {
        this.hudModel.setLives(lives);
        this.hudModel.maxLives = maxLives;
      }),
      bus.on(Events.LIVES_DEPLETED, () => this.onGameOver()),
      bus.on(Events.APP_BLURRED, () => this.pause()),
    );
  }

  onItemCollected(item: LevelItem & { kind?: string; fact?: string }): void {
    if (this.status !== Status.RUNNING) return;
    // The objective is done: nothing left to answer on the way to the portal.
    if (this.portalOpen) return;

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
    this._sinceProgress = 0;
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

    this._showFeedback(FeedbackKind.CORRECT, 'Muito bem! Você encontrou!', GAMEPLAY.wrongFeedbackDuration);
    this._openPortal();
  }

  /** Speedrun advance: next letter checkpoint, or marathon victory on Z. */
  private _advanceSpeedrun(run: SpeedrunRun): void {
    if (run.advance()) {
      const nextLetter = run.currentLetter;
      this.lesson = this._letterLesson(nextLetter, run.currentIndex);
      this.validator = new AnswerValidator(this.lesson);
      this.stream.setTarget(nextLetter, this.player.body.x);
      this._popWithdrawn();

      this._setObjective(this.lesson.objective ?? '');
      this.hudModel.setSpeedrunProgress(run.progressText);
      this._showFeedback(FeedbackKind.CORRECT, `Boa! Agora letra ${nextLetter}!`, 0.8);
      // Queued after the praise instead of cutting it off.
      this.game.narrator?.speakLessonTarget(nextLetter, 'letter', { interrupt: false });
      // Continuous! The player does NOT stop, does NOT reload scene, keeps running!
      return;
    }

    // Collected Z! Only the portal is left.
    this._showFeedback(FeedbackKind.CORRECT, 'Z! Corra até o portal!', 1.5);
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
      this._popWithdrawn();
      this._showFeedback(FeedbackKind.CORRECT, `Boa! Agora a letra ${run.currentLetter}!`, 0.8);
      if (this.support.narrateNextLetter) this._speakNextLetter(run.currentLetter);
      return;
    }

    const word = run.word.label;
    this._showFeedback(FeedbackKind.CORRECT, `Você montou ${word}! Corra até o portal!`, 1.5);
    this._openPortal(`Você montou a palavra ${word.toLowerCase()}! O portal abriu, corra até ele!`);
  }

  /** Last target collected: seal the world with an arrival stretch and the portal; the phase ends only inside it. */
  private _openPortal(announcement = 'O portal abriu! Corra até ele!'): void {
    if (this.portalOpen) return;
    this.portalOpen = true;
    const finish = this.stream.spawnPortal(this.player.body.x, {
      visibleRight: this.camera.x + this.camera.viewport.width,
    });
    this._popWithdrawn();
    this._syncTerrain();
    this._playPortalIntro(finish);
    this.hudModel.setTargetPointer(null);
    this._setObjective('Corra até o portal!');
    // Queued after the praise, so neither cancels the other.
    this.game.narrator?.speak?.(announcement, { interrupt: false });
  }

  onPortalEntered(): void {
    if (this.status !== Status.RUNNING || !this.portalOpen) return;
    this.winLevel({ viaPortal: true });
  }

  /** Wrong-answer flow: count the mistake, cost a heart (unless assisted), show guidance. */
  private _handleWrongAnswer(
    item: LevelItem & { label?: string },
    profile: { id: string } | null,
    centerX: number,
    centerY: number,
  ): void {
    this.mistakes += 1;
    if (profile) this.game.progress.recordAnswer(profile.id, false);
    if (this.support.wrongAnswerCostsHeart) this.lives.loseHeart();
    vibrateWarning();
    this.game.effects.spawnPuff(centerX, centerY, 14, '#ff5d73');
    this.game.effects.spawnFloatingText?.(centerX, centerY - 20, 'Ops!', '#ff5d73');
    this._showFeedback(
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
    if (this.status !== Status.RUNNING) return;
    // After the objective the way to the portal only sends the player back, never ends the run.
    if (!this.portalOpen) this.lives.loseHeart();
    if (this.status !== Status.RUNNING) return;
    vibrateWarning();
    this._showFeedback(FeedbackKind.WRONG, 'Ai! Cuidado!', GAMEPLAY.wrongFeedbackDuration);
    this.respawn();
  }

  /** Falling costs no heart — the player just returns to the checkpoint. */
  respawn(): void {
    if (this.status === Status.WON) return;
    this.player.reset(this.levelManager.getRespawnPoint());
    this.levelManager.resetTransientState();
    this.camera.snapTo(this.player.body);
    this.game.effects.clear();
  }

  winLevel({ viaPortal = false }: { viaPortal?: boolean } = {}): void {
    if (this.status === Status.WON || this.status === Status.GAME_OVER) return;
    this.status = Status.WON;
    this._winElapsed = 0;
    this._winViaPortal = viaPortal;
    this._winCalm = viaPortal && this._reducedMotion;
    this.hudModel.setTargetPointer(null);
    vibrateVictory();
    if (this.mode === 'speedrun' || this.mode === 'explore') {
      this.game.narrator?.speakPraise('Parabéns!');
    }
    const centerX = this.player.body.x + this.player.body.w / 2;
    if (viaPortal) {
      if (this._winCalm) {
        this._winTimer = PORTAL_WIN_SECONDS_CALM;
        return;
      }
      // The suction pulls the player in; the burst and the flash follow (see _updatePortalEntry).
      this._winTimer = PORTAL_WIN_SECONDS;
      this.game.effects.spawnSuction(centerX, this.player.body.y + this.player.body.h / 2);
      return;
    }
    this._winTimer = this.mode === 'speedrun' || this.mode === 'explore' ? 1.2 : GAMEPLAY.celebrationDuration;
    this.game.effects.spawnConfetti(centerX, this.player.body.y, 96);
  }

  finishLevel(): void {
    if (this._finished) return;
    this._finished = true;
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
        journey: this.exploreRun.journey,
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
    if (this.status === Status.WON || this.status === Status.GAME_OVER) return;
    this.status = Status.GAME_OVER;
    this.hudModel.setTargetPointer(null);
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
      this.game.startExploration(this.exploreRun?.word.id, this.exploreRun?.journey);
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
