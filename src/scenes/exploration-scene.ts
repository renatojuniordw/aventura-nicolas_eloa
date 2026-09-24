import { Scene } from '../core/scene.js';
import { Events } from '../core/event-bus.js';
import { Actions } from '../input/actions.js';
import { PhysicsEngine } from '../physics/physics-engine.js';
import { PlayerController } from '../gameplay/player/player-controller.js';
import { DiscoveryRun } from '../gameplay/discovery-run.js';
import { DISCOVERIES, DISCOVERY_LEVEL } from '../content/discoveries.js';
import { getCharacter } from '../content/characters.js';
import { Camera } from '../render/camera.js';
import { lessonAssets } from '../render/asset-plan.js';
import { drawDiscoveries } from '../render/discovery-renderer-v2.js';
import type { CanvasRenderer } from '../render/canvas-renderer.js';
import { DiscoveryHud } from '../ui/discovery-hud.js';
import { pumpMenuKeys } from '../ui/overlay-input.js';
import { tryLockLandscape } from '../ui/orientation.js';

/** Free play has its own rules; it never validates answers or changes lesson scores. */
export class ExplorationScene extends Scene {
  player!: PlayerController;
  camera!: Camera;
  run = new DiscoveryRun(DISCOVERIES);
  paused = false;
  private hud!: DiscoveryHud;
  private character = getCharacter(undefined);
  private unsubscribe: (() => void) | null = null;
  private motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  private reducedMotion = () => this.motionPreference?.matches ?? false;
  private supportLevel: 'assisted' | 'standard' | 'challenge' = 'standard';

  override enter(): void {
    this.player = new PlayerController({ x: 100, y: 410, physics: new PhysicsEngine() });
    this.run = new DiscoveryRun(DISCOVERIES);
    this.supportLevel = this.game.experience.read().supportLevel;
    this.camera = new Camera({ maxX: DISCOVERY_LEVEL.worldWidth - 960 });
    this.character = getCharacter(this.game.profiles.getActiveProfile()?.characterId);
    this.game.sprites.setLevel(DISCOVERY_LEVEL);
    this.game.assets.load(lessonAssets(DISCOVERY_LEVEL, this.character)).catch(() => {});
    this.hud = new DiscoveryHud();
    this.hud.updateProgress(0, this.run.objects.length);
    this.game.hudControls.showPauseButton({ onPause: () => this.togglePause(), onRepeat: () => this.repeat() });
    if (this.game.device.isTouch) this.game.touchControls.show();
    this.unsubscribe = this.game.bus.on(Events.APP_BLURRED, () => this.pause());
    this.game.narrator.speak(this.supportLevel === 'assisted' ? 'Bem-vindo! Siga a seta e chegue perto de cada figura. Use as setas para andar e o botão de pulo.' : 'Bem-vindo ao quintal! Ande e pule perto das figuras para descobrir.');
    void tryLockLandscape();
  }

  repeat(): void {
    const item = this.run.active;
    this.game.narrator.speak(item ? `${item.label}. ${item.fact}` : 'Ande e pule perto das figuras. Você pode brincar em qualquer ordem.');
  }

  override update(dt: number): void {
    if (this.game.input.consumePressed(Actions.PAUSE)) this.togglePause();
    if (this.paused) { pumpMenuKeys(this.game); return; }
    const axis = this.game.input.getMoveAxis();
    if (axis < 0) this.player.moveLeft();
    else if (axis > 0) this.player.moveRight();
    else this.player.stop();
    if (this.game.input.consumePressed(Actions.JUMP)) this.player.jump();
    this.player.holdJump(this.game.input.isActionHeld(Actions.JUMP));
    this.player.update(dt, DISCOVERY_LEVEL);
    if (this.player.body.y > DISCOVERY_LEVEL.worldHeight) this.player.reset({ x: 100, y: 410 });
    this.camera.follow(this.player.body);
    const item = this.run.update(this.player.body, dt);
    if (item) {
      this.hud.show(item.label, this.supportLevel === 'challenge' ? `${item.fact} Desafio opcional: ${item.challenge}` : item.fact, true);
      this.hud.updateProgress(this.run.discovered.size, this.run.objects.length);
      this.repeat();
      const profile = this.game.profiles.getActiveProfile();
      if (profile) this.game.progress.recordDiscovery(profile.id, item.id);
    }
  }

  override draw(renderer: CanvasRenderer): void {
    this.game.sprites.drawBackground(renderer, this.camera.x);
    renderer.setCamera(this.camera.x, this.camera.y);
    this.game.sprites.drawTerrain(renderer);
    const guide = this.supportLevel === 'assisted' ? this.run.objects.find((item) => !this.run.discovered.has(item.id))?.id : null;
    drawDiscoveries(renderer, this.run, this.reducedMotion() || this.game.experience.read().reducedMotion, guide);
    this.game.sprites.drawPlayer(renderer, this.player, this.character);
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.game.input.reset();
    this.game.narrator.stop();
    this.game.touchControls.hide();
    this.showPause();
  }

  private showPause(): void {
    this.game.menu.showExplorationPause({
      onResume: () => this.resume(),
      onMenu: () => this.game.scenes.switchTo('menu'),
      isMuted: this.game.audio.isMuted,
      onToggleMute: () => { this.game.audio.toggleMuted(); this.showPause(); },
    });
  }

  private resume(): void {
    this.paused = false;
    this.game.menu.hide();
    this.game.input.reset();
    if (this.game.device.isTouch) this.game.touchControls.show();
  }

  togglePause(): void { if (this.paused) this.resume(); else this.pause(); }

  override exit(): void {
    this.unsubscribe?.();
    this.game.narrator.stop();
    this.game.menu.hide();
    this.game.touchControls.hide();
    this.game.hudControls.hidePauseButton();
    this.hud.destroy();
    this.game.input.reset();
  }
}
