import { describe, it, expect, vi } from 'vitest';
import { GameScene } from './game-scene.js';
import { EventBus, Events } from '../core/event-bus.js';
import { GAMEPLAY } from '../core/config.js';
import * as curriculum from '../content/curriculum.js';
import { buildSpeedrunCourse } from '../gameplay/speedrun-course.js';
import { AnswerValidator } from '../content/answer-validator.js';
import { FeedbackKind } from '../render/hud-model.js';

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
      spawnFloatingText: vi.fn(),
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
      resync: vi.fn(),
    },
    debug: { enabled: false, toggle: vi.fn() },
    scenes: { switchTo: vi.fn() },
    startSpeedrun: vi.fn(),
    phoneControl: { isActive: false, start: vi.fn(), stop: vi.fn() },
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

  it('uses a shorter celebration timer for speedrun wins, transitioning after the correct delay', () => {
    // Speedrun: winLevel → status 'won' → finishLevel after short timer (1.2s)
    const speedrunGame = makeFakeGame();
    const speedrun = enterSpeedrun(speedrunGame);
    speedrun.winLevel();
    expect(speedrun.status).toBe('won');

    // Advance past the speedrun timer
    speedrun.update(1.3);
    expect(speedrunGame.scenes.switchTo).toHaveBeenCalledWith(
      'victory',
      expect.objectContaining({ mode: 'speedrun' }),
    );

    // Normal lesson: timer should be longer (celebrationDuration from config = 2.2s)
    const normalGame = makeFakeGame();
    normalGame.scenes.switchTo = vi.fn();
    const normal = enterNormalLesson(normalGame);
    normal.winLevel();
    expect(normal.status).toBe('won');

    // Before the timer expires the transition should NOT have happened yet
    normal.update(GAMEPLAY.celebrationDuration - 0.1);
    expect(normalGame.scenes.switchTo).not.toHaveBeenCalled();

    // Once the timer does expire it transitions
    normal.update(0.2);
    expect(normalGame.scenes.switchTo).toHaveBeenCalledWith(
      'victory',
      expect.objectContaining({ lessonId: expect.any(String) }),
    );
  });

  it('resyncs the input adapter on resume, so a hardware-less adapter (AutoRunAdapter) is not left stuck after reset()', () => {
    const game = makeFakeGame();
    const scene = enterNormalLesson(game);

    scene.pause();
    expect(game.input.reset).toHaveBeenCalledTimes(1);
    expect(game.input.resync).not.toHaveBeenCalled();

    scene.resume();
    expect(game.input.reset).toHaveBeenCalledTimes(2);
    expect(game.input.resync).toHaveBeenCalledTimes(1);
  });

  it('does nothing on resume when the scene was never paused', () => {
    const game = makeFakeGame();
    const scene = enterNormalLesson(game);

    scene.resume();

    expect(game.input.reset).not.toHaveBeenCalled();
    expect(game.input.resync).not.toHaveBeenCalled();
    expect(game.menu.hide).not.toHaveBeenCalled();
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

  it('displays marathon victory when the final Z letter is collected in speedrun mode', () => {
    const game = makeFakeGame({ profiles: { getActiveProfile: vi.fn(() => ({ id: 'p1' })) } });
    const scene = enterSpeedrun(game);

    // Simulate being at the last letter (Z, index 25 of 0-based 26-letter alphabet)
    scene.currentIndex = 25;
    scene.lesson = { id: 'alfabeto-z', target: 'Z', objective: 'Colete a letra Z' };
    scene.validator = new AnswerValidator(scene.lesson);

    const zTarget = scene.level.items.find(
      (item) => item.type === 'target' && item.segmentIndex === 25,
    );
    expect(zTarget).toBeDefined();
    expect(zTarget.label).toBe('Z');

    scene.onItemCollected(zTarget);

    // Triggers the marathon-concluded feedback and winLevel
    expect(scene.status).toBe('won');
    expect(scene.hudModel.feedback.message).toBe('Parabéns! Maratona concluída!');
    expect(game.effects.spawnConfetti).toHaveBeenCalled();

    // Advance past the short speedrun celebration timer (1.2s)
    scene.update(1.3);
    expect(game.progress.recordSpeedrunTime).toHaveBeenCalledWith('p1', expect.any(Number));
    expect(game.scenes.switchTo).toHaveBeenCalledWith(
      'victory',
      expect.objectContaining({ mode: 'speedrun' }),
    );
  });

  it('rejects an item from a future speedrun segment', () => {
    const game = makeFakeGame();
    const scene = enterSpeedrun(game);

    const futureItem = scene.level.items.find(
      (item) => item.type === 'target' && item.segmentIndex === 3,
    );
    expect(futureItem).toBeDefined();

    scene.onItemCollected(futureItem);

    // Should stay in current segment and show WRONG feedback
    expect(scene.currentIndex).toBe(0);
    expect(scene.hudModel.feedback.kind).toBe(FeedbackKind.WRONG);
    expect(scene.hudModel.feedback.message).toContain('mais à frente');
  });

  it('shows the future-letter hint once per window, not on every overlapping frame', () => {
    const game = makeFakeGame();
    const scene = enterSpeedrun(game);
    const futureItem = scene.level.items.find(
      (item) => item.type === 'target' && item.segmentIndex === 3,
    );

    scene.onItemCollected(futureItem);
    scene.hudModel.showFeedback(FeedbackKind.CORRECT, 'marker', 1);
    scene.speedrunElapsed += 0.1;
    scene.onItemCollected(futureItem);

    expect(scene.hudModel.feedback.message).toBe('marker');
    expect(scene.levelManager.collected.has(futureItem.id)).toBe(false);
  });

  it('wires pause menu restart for normal mode and speedrun mode', () => {
    // Normal mode: restart → switchTo('game', { lessonId })
    const normalGame = makeFakeGame();
    const normal = enterNormalLesson(normalGame);
    normal.pause();

    const { onRestart: normalRestart } = normalGame.menu.showPause.mock.calls[0][0];
    normalRestart();
    expect(normalGame.scenes.switchTo).toHaveBeenCalledWith('game', { lessonId: normal.lesson.id });

    // Speedrun mode: restart → game.startSpeedrun()
    const speedrunGame = makeFakeGame();
    const speedrun = enterSpeedrun(speedrunGame);
    speedrun.pause();

    const { onRestart: speedrunRestart } = speedrunGame.menu.showPause.mock.calls[0][0];
    speedrunRestart();
    expect(speedrunGame.startSpeedrun).toHaveBeenCalledTimes(1);
  });

  it('wires pause menu "go to menu" for both modes', () => {
    const game = makeFakeGame();
    const scene = enterNormalLesson(game);
    scene.pause();

    const { onMenu } = game.menu.showPause.mock.calls[0][0];
    onMenu();
    expect(game.scenes.switchTo).toHaveBeenCalledWith('menu');
  });

  it('tells the pause menu whether phone control is active', () => {
    const game = makeFakeGame({ phoneControl: { isActive: true, start: vi.fn(), stop: vi.fn() } });
    const scene = enterNormalLesson(game);
    scene.pause();

    const { isPhoneControlActive } = game.menu.showPause.mock.calls[0][0];
    expect(isPhoneControlActive).toBe(true);
  });

  it('disabling phone control from the pause menu stops it and resumes play immediately', () => {
    const game = makeFakeGame({ phoneControl: { isActive: true, start: vi.fn(), stop: vi.fn() } });
    const scene = enterNormalLesson(game);
    scene.pause();

    const { onDisablePhoneControl } = game.menu.showPause.mock.calls[0][0];
    onDisablePhoneControl();

    expect(game.phoneControl.stop).toHaveBeenCalledTimes(1);
    expect(game.menu.hide).toHaveBeenCalledTimes(1);
    expect(game.input.resync).toHaveBeenCalledTimes(1);
  });
});

it.each([['word', 'palavra'], ['syllable', 'sílaba'], ['letter', 'letra']])('describes incorrect %s content accurately', (type, noun) => {
  const narrator = { speak: vi.fn(), speakLessonTarget: vi.fn() };
  const game = makeFakeGame({ narrator });
  const scene = enterNormalLesson(game);
  scene.lesson = { ...scene.lesson, type };
  scene.onItemCollected({ id: 'wrong', label: 'BOLA', value: 'BOLA', type: 'distractor', x: 0, y: 0, w: 32, h: 32 });
  expect(narrator.speak).toHaveBeenCalledWith(expect.stringContaining(`Essa é a ${noun} bola`));
});
