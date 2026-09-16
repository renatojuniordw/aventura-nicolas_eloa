import { COLORS, VIEWPORT } from '../core/config.js';
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

// Alpha bounding boxes for trimmed pixel art assets
const LETTER_CARRIER_BOUNDS = Object.freeze({ sx: 113, sy: 150, sw: 889, sh: 849 });
const CHECKPOINT_BOUNDS = Object.freeze({ sx: 73, sy: 113, sw: 1126, sh: 1067 });
const FINISH_PORTAL_BOUNDS = Object.freeze({ sx: 49, sy: 55, sw: 1178, sh: 1142 });

function resolveBackgroundKey(level) {
  if (!level) return 'bg:primavera-lago';
  if (level.background && typeof level.background === 'string') {
    if (level.background.startsWith('bg:')) return level.background;
    if (level.background.includes('pomar')) return 'bg:primavera-pomar';
    if (level.background.includes('bosque')) return 'bg:outono-bosque';
    if (level.background.includes('vale')) return 'bg:outono-vale';
    if (level.background.includes('garden')) return 'bg:garden-pixel';
  }

  // Pick themed background by level category
  const id = level.id ?? '';
  if (id.includes('palavras') || id.includes('dificil')) return 'bg:outono-bosque';
  if (id.includes('silabas')) return 'bg:primavera-pomar';
  if (id.includes('encontros')) return 'bg:outono-vale';
  return 'bg:primavera-lago';
}

/**
 * Draws the world: panoramic parallax backgrounds, terrain, checkpoints,
 * finish portals, letter tokens, hazards and animated player.
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

  /** Draw panoramic background with smooth camera parallax. */
  drawBackground(renderer, cameraX = 0) {
    const bgKey = resolveBackgroundKey(this._level);
    const bgImage = this._assets?.has(bgKey) ? this._assets.get(bgKey) : null;

    if (bgImage && typeof renderer.screenImage === 'function' && bgImage.width && bgImage.height) {
      try {
        const viewportW = renderer.width || VIEWPORT.width;
        const viewportH = renderer.height || VIEWPORT.height;
        const bgW = Math.round((bgImage.width / bgImage.height) * viewportH);
        const parallaxSpeed = 0.28;
        let offsetX = -Math.round((cameraX * parallaxSpeed) % bgW);
        if (offsetX > 0) offsetX -= bgW;
        while (offsetX < viewportW) {
          renderer.screenImage(bgImage, offsetX, 0, bgW, viewportH);
          offsetX += bgW;
        }
        return;
      } catch {
        // Fallback to solid color on draw error
      }
    }

    renderer.clear(this._level?.background ?? COLORS.sky);
  }

  drawTerrain(renderer) {
    const level = this._level;
    if (!level) return;

    for (const solid of level.solids) {
      renderer.worldFillRect(solid.x, solid.y, solid.w, solid.h, COLORS.ground);
      // Subdued bottom rim for depth
      renderer.worldFillRect(solid.x, solid.y + solid.h - 4, solid.w, 4, '#482a13');
    }
    // Grass strip on every exposed top surface with 16-bit highlights
    for (const surface of this._surfaces) {
      renderer.worldFillRect(surface.x, surface.y, surface.w, 8, COLORS.groundTop);
      renderer.worldFillRect(surface.x, surface.y, surface.w, 2, '#a5df57');
      renderer.worldFillRect(surface.x, surface.y + 7, surface.w, 2, '#503518');
    }
    for (const platform of level.oneWayPlatforms) {
      renderer.worldFillRect(platform.x, platform.y, platform.w, platform.h, COLORS.platform);
      renderer.worldFillRect(platform.x, platform.y, platform.w, 4, '#f2ce80');
      renderer.worldFillRect(platform.x, platform.y + platform.h - 3, platform.w, 3, '#8e561d');
    }
  }

  /** Draws checkpoint flags and the finish portal. */
  drawObjects(renderer, level = this._level, checkpoints = null) {
    if (!level) return;
    const now = this._now();

    // 1. Checkpoint flags
    const cpImg = this._assets?.has('object:checkpoint')
      ? this._assets.get('object:checkpoint')
      : null;

    const pointsToDraw = checkpoints && Array.isArray(checkpoints)
      ? checkpoints
      : (level.checkpoint ? [level.checkpoint] : []);

    if (cpImg && typeof renderer.worldImage === 'function') {
      const flagW = 44;
      const flagH = 44;
      for (const pt of pointsToDraw) {
        renderer.worldImage(
          cpImg,
          CHECKPOINT_BOUNDS.sx,
          CHECKPOINT_BOUNDS.sy,
          CHECKPOINT_BOUNDS.sw,
          CHECKPOINT_BOUNDS.sh,
          pt.x - 10,
          pt.y - 2,
          flagW,
          flagH,
        );
      }
    }

    // 2. Finish Portal
    const portalImg = this._assets?.has('object:finish-portal')
      ? this._assets.get('object:finish-portal')
      : null;

    if (portalImg && typeof renderer.worldImage === 'function') {
      const portalW = 86;
      const portalH = 84;
      const portalX = (level.worldWidth ?? 1920) - 130;
      const portalY = (level.worldHeight ?? 540) - 92 - portalH;

      // Soft magical portal pulse
      const shimmer = Math.sin(now / 320) * 0.15 + 0.85;
      renderer.worldFillRect(
        portalX + 22,
        portalY + 20,
        portalW - 44,
        portalH - 24,
        `rgba(110, 225, 255, ${shimmer * 0.4})`,
      );

      renderer.worldImage(
        portalImg,
        FINISH_PORTAL_BOUNDS.sx,
        FINISH_PORTAL_BOUNDS.sy,
        FINISH_PORTAL_BOUNDS.sw,
        FINISH_PORTAL_BOUNDS.sh,
        portalX,
        portalY,
        portalW,
        portalH,
      );
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
    const carrierImg = this._assets?.has('item:letter-carrier')
      ? this._assets.get('item:letter-carrier')
      : null;
    const now = this._now();

    for (const item of items) {
      if (collectedIds.has(item.id)) continue;
      const isTarget = item.type === 'target';

      // Gentle floating bob
      const bob = Math.sin((now / 220) + (item.x * 0.05)) * 3.5;
      const drawY = item.y + bob;

      if (carrierImg && typeof renderer.worldImage === 'function') {
        const pad = 6;
        const tokenX = item.x - pad;
        const tokenY = drawY - pad;
        const tokenW = item.w + pad * 2;
        const tokenH = item.h + pad * 2;

        if (isTarget) {
          // Golden halo around target letter
          renderer.worldFillRect(
            tokenX - 2,
            tokenY - 2,
            tokenW + 4,
            tokenH + 4,
            'rgba(255, 215, 0, 0.35)',
          );
        }

        renderer.worldImage(
          carrierImg,
          LETTER_CARRIER_BOUNDS.sx,
          LETTER_CARRIER_BOUNDS.sy,
          LETTER_CARRIER_BOUNDS.sw,
          LETTER_CARRIER_BOUNDS.sh,
          tokenX,
          tokenY,
          tokenW,
          tokenH,
        );

        renderer.worldText(item.label, item.x + item.w / 2, drawY + item.h / 2, {
          color: isTarget ? '#142420' : '#483522',
          font: 'bold 20px "Trebuchet MS", "Courier New", monospace',
        });
      } else {
        renderer.worldFillRect(item.x, item.y, item.w, item.h, isTarget ? COLORS.target : COLORS.distractor);
        renderer.worldText(item.label, item.x + item.w / 2, item.y + item.h / 2 + 1, {
          color: '#ffffff',
          font: 'bold 18px "Trebuchet MS", sans-serif',
        });
      }
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
function computeSurfaces(solids = []) {
  if (!solids || !Array.isArray(solids)) return [];
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
