import { COLORS } from '../core/config.js';
import { PlayerStateId } from '../gameplay/player/player-state.js';
import { POSE_BY_STATE, POSE_FRAMES, frameRect } from './atlas-meta.js';

/** How long each animation frame stays on screen. */
const FRAME_DURATION_MS = 110;

/**
 * The hitbox (30x42) is deliberately tight for fair collisions; the visible
 * sprite is drawn larger than that and bottom-aligned to it, so the character
 * reads clearly on screen without changing any physics.
 */
const SPRITE_SCALE = 1.8;

/**
 * Draws the world. Terrain/items/hazards are still placeholder shapes; the
 * player is drawn from the active character's pose art (preloaded by the
 * `AssetManager` in `BootScene`), animating through that pose's frame grid,
 * and falling back to a coloured rectangle when an image has not finished
 * loading (or none was provided, e.g. in tests).
 */
export class SpriteRenderer {
  constructor({ atlas = null, assets = null, now = () => Date.now() } = {}) {
    this.atlas = atlas;
    this._assets = assets;
    this._now = now;
    this._level = null;
    this._surfaces = [];
    this._animPose = null;
    this._animStart = 0;
  }

  /** Cache per-level render data (grass tops) when a level is loaded. */
  setLevel(level) {
    this._level = level;
    this._surfaces = computeSurfaces(level.solids);
  }

  drawBackground(renderer) {
    renderer.clear(this._level?.background ?? COLORS.sky);
  }

  drawTerrain(renderer) {
    const level = this._level;
    if (!level) return;

    for (const solid of level.solids) {
      renderer.worldFillRect(solid.x, solid.y, solid.w, solid.h, COLORS.ground);
    }
    // Grass strip on every exposed top surface.
    for (const surface of this._surfaces) {
      renderer.worldFillRect(surface.x, surface.y, surface.w, 8, COLORS.groundTop);
    }
    for (const platform of level.oneWayPlatforms) {
      renderer.worldFillRect(platform.x, platform.y, platform.w, platform.h, COLORS.platform);
      renderer.worldFillRect(platform.x, platform.y, platform.w, 6, '#e8b366');
    }
  }

  drawHazards(renderer, hazards) {
    for (const hazard of hazards) {
      renderer.worldFillRect(hazard.x, hazard.y + hazard.h / 2, hazard.w, hazard.h / 2, COLORS.hazard);
      const spikes = Math.max(1, Math.round(hazard.w / 16));
      const spikeWidth = hazard.w / spikes;
      for (let i = 0; i < spikes; i += 1) {
        const size = Math.min(spikeWidth, hazard.h / 2);
        renderer.worldFillRect(
          hazard.x + i * spikeWidth + (spikeWidth - size) / 2,
          hazard.y + hazard.h / 2 - size,
          size,
          size,
          '#ff8b5e',
        );
      }
    }
  }

  /** @param {Set<string>} collectedIds */
  drawItems(renderer, items, collectedIds = new Set()) {
    for (const item of items) {
      if (collectedIds.has(item.id)) continue;
      const isTarget = item.type === 'target';
      renderer.worldFillRect(item.x, item.y, item.w, item.h, isTarget ? COLORS.target : COLORS.distractor);
      renderer.worldText(item.label, item.x + item.w / 2, item.y + item.h / 2 + 1, {
        color: '#ffffff',
        font: 'bold 18px "Trebuchet MS", sans-serif',
      });
    }
  }

  drawPlayer(renderer, player, character = null) {
    const pose = POSE_BY_STATE[player.state] ?? 'idle';
    const image = this._poseImage(character, pose);
    if (image) {
      const frame = this._currentFrame(pose, image);
      const dh = player.body.h * SPRITE_SCALE;
      const dw = dh * (frame.sw / frame.sh);
      const dx = player.body.x + player.body.w / 2 - dw / 2;
      const dy = player.body.y + player.body.h - dh;
      renderer.worldImage(image, frame.sx, frame.sy, frame.sw, frame.sh, dx, dy, dw, dh, {
        flipX: player.facing < 0,
      });
      return;
    }
    this._drawPlaceholderPlayer(renderer, player);
  }

  _poseImage(character, pose) {
    if (!this._assets || !character?.sprites) return null;
    const key = `${character.id}:${character.sprites[pose] ? pose : 'idle'}`;
    return this._assets.has(key) ? this._assets.get(key) : null;
  }

  /** Picks the frame for the current pose, restarting the cycle on pose change. */
  _currentFrame(pose, image) {
    const now = this._now();
    if (pose !== this._animPose) {
      this._animPose = pose;
      this._animStart = now;
    }
    const grid = POSE_FRAMES[pose] ?? POSE_FRAMES.idle;
    const frameIndex = Math.floor((now - this._animStart) / FRAME_DURATION_MS);
    return frameRect(image, grid, frameIndex);
  }

  _drawPlaceholderPlayer(renderer, player) {
    const { x, y, w, h } = player.body;
    const airborne = player.state === PlayerStateId.JUMP || player.state === PlayerStateId.FALL;
    renderer.worldFillRect(x, y, w, h, airborne ? '#f2645f' : COLORS.player);
    // Facing marker: the "face" points in the direction of travel.
    const faceWidth = 8;
    const faceX = player.facing >= 0 ? x + w - faceWidth - 3 : x + 3;
    renderer.worldFillRect(faceX, y + 8, faceWidth, 10, COLORS.playerFacing);
    // Shoes.
    renderer.worldFillRect(x + 2, y + h - 6, w - 4, 6, '#6b3a1f');
  }

  /** Debug overlay: hitboxes and atlas grid (toggled with F2). */
  drawDebug(renderer, { player, level, items, hazards }) {
    for (const solid of level.solids) {
      renderer.worldStrokeRect(solid.x, solid.y, solid.w, solid.h, 'rgba(255,0,0,0.5)', 1);
    }
    for (const platform of level.oneWayPlatforms) {
      renderer.worldStrokeRect(platform.x, platform.y, platform.w, platform.h, 'rgba(0,128,255,0.7)', 1);
    }
    for (const item of items) {
      renderer.worldStrokeRect(item.x, item.y, item.w, item.h, 'rgba(0,255,0,0.8)', 1);
    }
    for (const hazard of hazards) {
      renderer.worldStrokeRect(hazard.x, hazard.y, hazard.w, hazard.h, 'rgba(255,128,0,0.9)', 1);
    }
    renderer.worldStrokeRect(player.body.x, player.body.y, player.body.w, player.body.h, '#ff00ff', 2);
  }
}

/**
 * A solid rectangle is a visible "surface" when no larger rectangle sits
 * directly on top of it — that is where the grass strip belongs.
 */
function computeSurfaces(solids) {
  return solids.filter(
    (solid) =>
      !solids.some(
        (other) =>
          other !== solid &&
          other.x <= solid.x &&
          other.x + other.w >= solid.x + solid.w &&
          Math.abs(other.y + other.h - solid.y) < 0.5,
      ),
  );
}
