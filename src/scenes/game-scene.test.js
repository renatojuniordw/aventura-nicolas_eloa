import { describe, it, expect, vi } from 'vitest';
import { GameScene } from './game-scene.js';
import { EventBus, Events } from '../core/event-bus.js';
import { GAMEPLAY } from '../core/config.js';
import * as curriculum from '../content/curriculum.js';
import { buildSpeedrunCourse } from '../gameplay/speedrun-course.js';

/**
 * Unit tests for the central orchestrator. `src/integration.test.js` already
 * drives the game end-to-end through real keyboard events, so this file
 * targets the branches that a jsdom smoke test does not reach: the speedrun
 * "wrong order" guard, per-mode game-over/finish wiring, and hazard hits.
 */

function makeFakeGame(overrides = {}) {
  const bus = new EventBus();
  return {
    bus,
    curriculum: {
      getLesson: curriculum.getLesson,
      lessonOrder: curriculum.LESSON_ORDER,
    },
    sprites: { setLevel: vi.fn() },
    hudControls: { showPauseButton: vi.fn(), hidePauseButton: vi.fn() },
    profiles: { getActiveProfile: vi.fn(() => null) },
    progress: {
      recordAnswer: vi.fn(),
      recordSpeedrunTime: vi.fn(() => ({ bestTime: 10, isNewBest: true })),
      completeLesson: vi.fn(() => ({ stars: 3 })),
    },
    effects: {
      spawnConfetti: vi.fn(),
      spawnPuff: vi.fn(),
      clear: vi.fn(),
      update: vi.fn(),
      draw: vi.fn(),
    },
    menu: { hide: vi.fn(), showGameOver: vi.fn(), showPause: vi.fn() },
    audio: { isMuted: false, toggleMuted: vi.fn() },
    input: {
      consumePressed: vi.fn(() => false),
      isActionHeld: vi.fn(() => false),
      getMoveAxis: vi.fn(() => 0),
      reset: vi.fn(),
    },
    debug: { enabled: false, toggle: vi.fn() },
    scenes: { switchTo: vi.fn() },
    startSpeedrun: vi.fn(),
    ...overrides,
  };
}

function enterNormalLesson(game, lessonId = curriculum.LESSON_ORDER[0]) {
  const scene = new GameScene(game);
  scene.enter({ lessonId });
  return scene;
}

function enterSpeedrun(game) {
  const scene = new GameScene(game);
  scene.enter({ mode: 'speedrun', speedrunCourse: buildSpeedrunCourse({ random: () => 0.42 }) });
  return scene;
}

describe('GameScene (unit)', () => {
  it('rejects a letter collected out of speedrun order without advancing', () => {
    const game = makeFakeGame();
    const scene = enterSpeedrun(game);

    const futureItem = scene.level.items.find(
      (item) => item.type === 'target' && item.segmentIndex === 1,
    );
    expect(scene.currentIndex).toBe(0);

    scene.onItemCollected(futureItem);

    expect(scene.currentIndex).toBe(0);
    expect(scene.lesson.target).toBe('A');
    expect(scene.levelManager.collected.has(futureItem.id)).toBe(false);
    expect(scene.status).toBe('running');
  });

  it('advances the checkpoint via the level manager, never mutating the frozen level', () => {
    const game = makeFakeGame();
    const scene = enterSpeedrun(game);
    const targetA = scene.level.items.find(
      (item) => item.type === 'target' && item.segmentIndex === 0,
    );

    scene.onItemCollected(targetA);

    expect(scene.currentIndex).toBe(1);
    expect(scene.levelManager.getRespawnPoint()).toEqual(scene.speedrunCheckpoints[1]);
    // The level object itself is frozen and was never touched.
    expect(scene.level.checkpoint).toEqual(scene.speedrunCheckpoints[0]);
  });

  it('loses a heart, shows a warning and respawns on a hazard hit', () => {
    const game = makeFakeGame();
    const scene = enterNormalLesson(game);
    const livesBefore = scene.lives.lives;
    const respawnSpy = vi.spyOn(scene, 'respawn');

    scene.onHazardHit();

    expect(scene.lives.lives).toBe(livesBefore - 1);
    expect(scene.hudModel.feedback.kind).toBe('wrong');
    expect(respawnSpy).toHaveBeenCalledTimes(1);
  });

  it('wires game over retry to restart the same lesson in normal mode', () => {
    const game = makeFakeGame();
    const scene = enterNormalLesson(game);

    scene.onGameOver();

    expect(scene.status).toBe('gameOver');
    expect(game.menu.showGameOver).toHaveBeenCalledTimes(1);
    const { onRetry, onMenu } = game.menu.showGameOver.mock.calls[0][0];

    onRetry();
    expect(game.scenes.switchTo).toHaveBeenCalledWith('game', { lessonId: scene.lesson.id });

    onMenu();
    expect(game.scenes.switchTo).toHaveBeenCalledWith('menu');
  });

  it('wires game over retry to game.startSpeedrun in speedrun mode', () => {
    const game = makeFakeGame();
    const scene = enterSpeedrun(game);

    scene.onGameOver();

    const { onRetry } = game.menu.showGameOver.mock.calls[0][0];
    onRetry();

    expect(game.startSpeedrun).toHaveBeenCalledTimes(1);
    expect(game.scenes.switchTo).not.toHaveBeenCalledWith('game', expect.anything());
  });

  it('finishes a normal lesson through progress.completeLesson', () => {
    const game = makeFakeGame({ profiles: { getActiveProfile: vi.fn(() => ({ id: 'p1' })) } });
    const scene = enterNormalLesson(game);
    scene.mistakes = 2;

    scene.finishLevel();

    expect(game.progress.completeLesson).toHaveBeenCalledWith('p1', scene.lesson.id, {
      mistakes: 2,
    });
    expect(game.scenes.switchTo).toHaveBeenCalledWith('victory', {
      lessonId: scene.lesson.id,
      mistakes: 2,
      stars: 3,
    });
  });

  it('finishes a speedrun through progress.recordSpeedrunTime', () => {
    const game = makeFakeGame({ profiles: { getActiveProfile: vi.fn(() => ({ id: 'p1' })) } });
    const scene = enterSpeedrun(game);
    scene.speedrunElapsed = 42;

    scene.finishLevel();

    expect(game.progress.recordSpeedrunTime).toHaveBeenCalledWith('p1', 42);
    expect(game.scenes.switchTo).toHaveBeenCalledWith('victory', {
      mode: 'speedrun',
      elapsed: 42,
      mistakes: 0,
      isNewBest: true,
      bestTime: 10,
      totalLetters: 26,
    });
  });

  it('uses a shorter celebration timer for speedrun wins than regular lessons', () => {
    const normal = enterNormalLesson(makeFakeGame());
    normal.winLevel();
    expect(normal._winTimer).toBe(GAMEPLAY.celebrationDuration);

    const speedrun = enterSpeedrun(makeFakeGame());
    speedrun.winLevel();
    expect(speedrun._winTimer).toBe(1.2);
  });

  it('re-renders the pause menu when muting from inside it', () => {
    const game = makeFakeGame();
    const scene = enterNormalLesson(game);

    scene.pause();
    expect(game.menu.showPause).toHaveBeenCalledTimes(1);

    const { onToggleMute } = game.menu.showPause.mock.calls[0][0];
    onToggleMute();

    expect(game.audio.toggleMuted).toHaveBeenCalledTimes(1);
    expect(game.menu.showPause).toHaveBeenCalledTimes(2);
  });

  it('reacts to LIVES_DEPLETED on the bus by ending the run', () => {
    const game = makeFakeGame();
    const scene = enterNormalLesson(game);

    game.bus.emit(Events.LIVES_DEPLETED, {});

    expect(scene.status).toBe('gameOver');
    expect(game.menu.showGameOver).toHaveBeenCalledTimes(1);
  });
});
