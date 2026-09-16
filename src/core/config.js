/**
 * Central configuration. Every tunable lives here so balancing the game is a
 * data change, never a code change (Open/Closed Principle).
 *
 * Coordinate system: screen-space pixels, origin at the top-left of the world,
 * y grows downward. Gravity is therefore positive and jump velocity negative.
 */

export const VIEWPORT = Object.freeze({ width: 960, height: 540 });

/** Simulation runs at a fixed 60 Hz regardless of display refresh rate. */
export const FIXED_STEP = 1 / 60;

/** Hard cap on catch-up steps per frame to survive tab-switch spikes. */
export const MAX_STEPS_PER_FRAME = 5;

export const PHYSICS = Object.freeze({
  gravity: 1500,
  maxFallSpeed: 900,
  jumpVelocity: -620,
  walkSpeed: 260,
  /** Lateral acceleration applied while airborne, as a fraction of walkSpeed. */
  airControl: 0.75,
  /** Upward velocity is cut to this fraction when jump is released early. */
  jumpCutMultiplier: 0.45,
});

export const PLAYER = Object.freeze({
  width: 30,
  height: 42,
  /** Seconds a jump input stays buffered before landing. */
  jumpBufferTime: 0.1,
  /** Grace period after leaving ground during which a jump is still allowed. */
  coyoteTime: 0.1,
});

export const CAMERA = Object.freeze({
  smoothing: 0.12,
  /** Horizontal offset from the viewport left edge where the player rests. */
  deadZoneRatio: 0.35,
});

export const GAMEPLAY = Object.freeze({
  startingLives: 3,
  /** Milliseconds a wrong-answer warning stays on screen. */
  wrongFeedbackDuration: 1.2,
  /** Seconds a completed level celebrates before advancing. */
  celebrationDuration: 2.2,
});

export const COLORS = Object.freeze({
  sky: '#9bd3f5',
  ground: '#6b4a2b',
  groundTop: '#8bc34a',
  platform: '#c98b3b',
  player: '#e04b4b',
  playerFacing: '#ffd166',
  target: '#3f8efc',
  distractor: '#b06bd6',
  hazard: '#e0562b',
  text: '#1b2430',
  hudText: '#ffffff',
  heartFull: '#ff5d73',
  heartEmpty: '#5a6473',
});

export const STORAGE = Object.freeze({
  keyPrefix: 'joguinho.sobrinhos',
  schemaVersion: 1,
});
