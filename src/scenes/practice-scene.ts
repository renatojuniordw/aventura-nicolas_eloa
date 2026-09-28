import { Scene } from '../core/scene.js';
import { Actions } from '../input/actions.js';
import { Events } from '../core/event-bus.js';
import { COLORS, VIEWPORT } from '../core/config.js';
import { PhysicsEngine } from '../physics/physics-engine.js';
import { PlayerController } from '../gameplay/player/player-controller.js';
import { ControlsPractice, hintedActions, practiceText } from '../gameplay/controls-practice.js';
import { getCharacter, type Character } from '../content/characters.js';
import { characterAssets } from '../render/asset-plan.js';
import { tryLockLandscape } from '../ui/orientation.js';
import type { CanvasRenderer } from '../render/canvas-renderer.js';
import type { Box } from '../physics/aabb.js';

interface PracticeParams {
  /** Where to go when the child finishes or skips (back to Settings, or on to the adventure). */
  onExit?: () => void;
}

const FLOOR_Y = 440;

/**
 * "Experimentar controles" (docs/18 §8): a short, safe arena — flat floor,
 * walls, no hazards, hearts, letters or timer — driven by the real input
 * adapters and the real PlayerController, so the gestures learned here are
 * exactly the ones the game uses. Steps advance on what the player actually
 * did (ControlsPractice); the TouchAdapter knows nothing about the tutorial.
 * Nothing here writes lessons, stars, records or the support level.
 */
export class PracticeScene extends Scene {
  physics = new PhysicsEngine();
  practice = new ControlsPractice();
  player!: PlayerController;
  private _level: { solids: Box[] } = {
    solids: [
      { x: -40, y: 0, w: 40, h: VIEWPORT.height },
      { x: 0, y: FLOOR_Y, w: VIEWPORT.width, h: VIEWPORT.height - FLOOR_Y },
      { x: VIEWPORT.width, y: 0, w: 40, h: VIEWPORT.height },
    ],
  };
  private _character: Character | null = null;
  private _onExit: () => void = () => this.game.scenes.switchTo('menu');
  private _finished = false;

  override enter(params: PracticeParams = {}): void {
    if (params.onExit) this._onExit = params.onExit;
    this.practice.restart();
    this._finished = false;
    this.player = new PlayerController({ x: VIEWPORT.width / 2 - 15, y: FLOOR_Y - 42, physics: this.physics });
    this._character = getCharacter(this.game.profiles.getActiveProfile()?.characterId);
    this.game.assets?.load(characterAssets(this._character)).catch(() => {});
    this.game.input.reset();
    if (this.game.device?.isTouch) this.game.touchControls.show();
    this.game.bus.emit(Events.INPUT_MODE_CHANGED, { playing: true });
    tryLockLandscape().catch(() => {});
    this._showStep();
  }

  override exit(): void {
    this.game.narrator?.stop();
    this.game.hudControls.hidePauseButton();
    this.game.touchControls.hide();
    this.game.bus?.emit(Events.INPUT_MODE_CHANGED, { playing: false });
  }

  override update(dt: number): void {
    if (this.game.input.consumePressed(Actions.PAUSE) || this.game.input.consumePressed(Actions.BACK)) {
      this.finish();
      return;
    }
    const input = this.game.input;
    const axis = input.getMoveAxis();
    if (axis < 0) this.player.moveLeft();
    else if (axis > 0) this.player.moveRight();
    else this.player.stop();
    if (input.consumePressed(Actions.JUMP)) this.player.jump();
    this.player.holdJump(input.isActionHeld(Actions.JUMP));

    const wasGrounded = this.player.body.grounded;
    this.player.update(dt, this._level);
    // A real take-off, not just a finger on the button (docs/18 §9).
    const jumped = wasGrounded && !this.player.body.grounded && this.player.body.vy < 0;

    if (this.practice.update({ dt, moveAxis: axis, jumped })) this._showStep();
    if (input.consumePressed(Actions.CONFIRM) && this.practice.done) this.finish();
  }

  /** Leaves the practice; completion is remembered only when the last step was reached. */
  finish(): void {
    if (this._finished) return;
    this._finished = true;
    if (this.practice.done) this.game.controlsPractice?.markCompleted();
    else this.game.controlsPractice?.markOffered();
    this._onExit();
  }

  repeat(): void {
    this.practice.restart();
    this._showStep();
  }

  private _showStep(): void {
    const isTouch = Boolean(this.game.device?.isTouch);
    const { title, body } = practiceText(this.practice.step, isTouch);
    this.game.touchControls.setHints(hintedActions(this.practice.step));
    this.game.hudControls.showPracticeCoach({
      stepNumber: this.practice.stepNumber,
      totalSteps: this.practice.totalSteps,
      title,
      body,
      done: this.practice.done,
      onSkip: () => this.finish(),
      onRepeat: () => this.repeat(),
      onFinish: () => this.finish(),
    });
    this.game.narrator?.speak(`${title}. ${body}`);
  }

  override draw(renderer: CanvasRenderer): void {
    renderer.clear(COLORS.sky);
    renderer.setCamera(0, 0);
    renderer.worldFillRect(0, FLOOR_Y, VIEWPORT.width, VIEWPORT.height - FLOOR_Y, COLORS.ground);
    this.game.sprites.drawPlayer(renderer, this.player, this._character);
  }
}
