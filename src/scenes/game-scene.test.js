import { describe, it, expect, vi } from 'vitest';
import { GameScene } from './game-scene.js';
import { EventBus, Events } from '../core/event-bus.js';
import { GAMEPLAY } from '../core/config.js';
import * as curriculum from '../content/curriculum.js';
import { createExploreStream, createSpeedrunStream } from '../gameplay/stream-courses.js';
import { ExploreRun } from '../gameplay/explore-run.js';
import { WORD_BANK } from '../content/word-bank.js';
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
      recordLessonAnswer: vi.fn(),
      recordSpeedrunTime: vi.fn(() => ({ bestTime: 10, isNewBest: true })),
      completeLesson: vi.fn(() => ({ stars: 3 })),
    },
    effects: {
      spawnConfetti: vi.fn(),
      spawnRing: vi.fn(),
      spawnSuction: vi.fn(),
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
  scene.enter({ mode: 'speedrun', stream: createSpeedrunStream({ random: () => 0.42 }) });
  return scene;
}

function enterExplore(game, wordId = 'gato') {
  const word = WORD_BANK.find((entry) => entry.id === wordId);
  const scene = new GameScene(game);
  scene.enter({
    mode: 'explore',
    stream: createExploreStream(word, { random: () => 0.42 }),
    exploreRun: new ExploreRun(word, { position: 2, total: 30 }),
  });
  return scene;
}

/** Collects the one live target, as the player touching it would. */
const collectTarget = (scene) => scene.onItemCollected(scene.stream.liveTarget);

/** Steps into the (fully grown) portal like a player running into it would. */
function walkIntoPortal(scene) {
  scene.stream.tick(1);
  const { finish } = scene.level;
  scene.player.body.x = finish.x;
  scene.player.body.y = finish.y;
  scene.update(0.016);
}

describe('GameScene explore (word phase)', () => {
  it('announces the word and shows the empty letter board on entering', () => {
    const narrator = { speakWordTarget: vi.fn(), speakPraise: vi.fn(), speak: vi.fn(), stop: vi.fn() };
    const scene = enterExplore(makeFakeGame({ narrator }));

    expect(narrator.speakWordTarget).toHaveBeenCalledWith('GATO');
    expect(scene.hudModel.objective).toBe('Monte a palavra: GATO');
    expect(scene.hudModel.boardSlots.map((slot) => slot.revealed)).toEqual([false, false, false, false]);
  });

  it('fills the board letter by letter, offering exactly one target at a time', () => {
    const scene = enterExplore(makeFakeGame());
    expect(scene.level.items.filter((item) => item.type === 'target')).toHaveLength(1);
    expect(scene.stream.liveTarget.label).toBe('G');

    collectTarget(scene);
    expect(scene.mistakes).toBe(0);
    expect(scene.status).toBe('running');
    expect(scene.hudModel.boardSlots.map((slot) => slot.revealed)).toEqual([true, false, false, false]);
    expect(scene.stream.liveTarget.label).toBe('A');
  });

  it('does not end the phase on the last letter: the portal opens and only entering it wins', () => {
    const game = makeFakeGame({ profiles: { getActiveProfile: vi.fn(() => ({ id: 'p1' })) } });
    game.progress.recordDiscovery = vi.fn();
    const scene = enterExplore(game);
    expect(scene.level.portalActive).toBe(false);

    for (let i = 0; i < 4; i += 1) collectTarget(scene);
    expect(scene.status).toBe('running');
    expect(scene.portalOpen).toBe(true);
    expect(scene.level.portalActive).toBe(true);
    expect(scene.hudModel.objective).toBe('Corra até o portal!');
    expect(game.progress.completeLesson).not.toHaveBeenCalled();

    walkIntoPortal(scene);
    expect(scene.status).toBe('won');

    scene.update(2);
    expect(game.progress.recordDiscovery).toHaveBeenCalledWith('p1', 'gato');
    expect(game.progress.completeLesson).toHaveBeenCalledWith('p1', 'palavra-gato', { mistakes: 0 });
    expect(game.scenes.switchTo).toHaveBeenCalledWith('victory', {
      mode: 'explore',
      wordId: 'gato',
      journey: [],
      mistakes: 0,
      stars: 3,
    });
  });

  it('shows the portal at once: ring, label and grow-in start on the very frame the last letter is collected', () => {
    const game = makeFakeGame();
    const scene = enterExplore(game);
    for (let i = 0; i < 3; i += 1) collectTarget(scene);
    expect(game.effects.spawnRing).not.toHaveBeenCalled();

    collectTarget(scene);

    const { finish } = scene.level;
    // On screen right away: within the ~620px the camera shows ahead of the player.
    expect(finish.x).toBeLessThan(scene.player.body.x + 620);
    expect(game.effects.spawnRing).toHaveBeenCalledTimes(1);
    expect(game.effects.spawnFloatingText).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'Portal!', expect.any(String));

    scene.update(0.2);
    expect(scene.level.portalReveal).toBeGreaterThan(0);
  });

  it('plays the portal exit: player swallowed, burst, then the victory screen', () => {
    const game = makeFakeGame();
    const scene = enterExplore(game);
    for (let i = 0; i < 4; i += 1) collectTarget(scene);

    walkIntoPortal(scene);
    expect(game.effects.spawnSuction).toHaveBeenCalledTimes(1);
    expect(game.scenes.switchTo).not.toHaveBeenCalled();

    scene.update(0.8);
    expect(game.effects.spawnConfetti).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 120);
    expect(game.scenes.switchTo).not.toHaveBeenCalled();

    scene.update(1);
    expect(game.scenes.switchTo).toHaveBeenCalledWith('victory', expect.objectContaining({ mode: 'explore' }));
  });

  it('ignores the portal until the last letter has been collected', () => {
    const scene = enterExplore(makeFakeGame());
    scene.onPortalEntered();
    expect(scene.status).toBe('running');
  });

  it('costs a heart for a wrong letter and retries the same word from the top', () => {
    const game = makeFakeGame({ startExploration: vi.fn() });
    const scene = enterExplore(game);
    const distractor = scene.level.items.find((item) => item.type === 'distractor');

    scene.onItemCollected(distractor);
    expect(scene.mistakes).toBe(1);

    scene.restart();
    expect(game.startExploration).toHaveBeenCalledWith('gato', []);
  });
});

describe('GameScene (unit)', () => {
  it('advances to the next letter and offers it as the single live target', () => {
    const scene = enterSpeedrun(makeFakeGame());
    expect(scene.stream.liveTarget.label).toBe('A');

    collectTarget(scene);

    expect(scene.currentIndex).toBe(1);
    expect(scene.lesson.target).toBe('B');
    expect(scene.stream.liveTarget.label).toBe('B');
    expect(scene.level.items.filter((item) => item.type === 'target')).toHaveLength(1);
  });

  it('moves the respawn point along with the segment the player is in, never touching the start', () => {
    const scene = enterSpeedrun(makeFakeGame());
    expect(scene.levelManager.getRespawnPoint()).toEqual({ x: 96, y: 406 });

    scene.player.body.x = 1920 * 2 + 300;
    scene.update(0.016);

    expect(scene.levelManager.getRespawnPoint()).toEqual({ x: 1920 * 2 + 96, y: 406 });
  });

  it('keeps generating world ahead as the player advances', () => {
    const scene = enterSpeedrun(makeFakeGame());
    const before = scene.level.worldWidth;

    scene.player.body.x = before - 900;
    scene.update(0.016);

    expect(scene.level.worldWidth).toBeGreaterThan(before);
    expect(scene.camera.maxX).toBe(Number.POSITIVE_INFINITY);
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

  it('opens the portal on Z and only finishes the marathon inside it', () => {
    const game = makeFakeGame({ profiles: { getActiveProfile: vi.fn(() => ({ id: 'p1' })) } });
    const scene = enterSpeedrun(game);

    // Fast-forward to the last letter, Z.
    scene.speedrun.currentIndex = 25;
    scene.lesson = { id: 'alfabeto-z', target: 'Z', objective: 'Colete a letra Z' };
    scene.validator = new AnswerValidator(scene.lesson);
    scene.stream.setTarget('Z');
    expect(scene.stream.liveTarget.label).toBe('Z');

    collectTarget(scene);

    expect(scene.status).toBe('running');
    expect(scene.portalOpen).toBe(true);
    expect(scene.hudModel.feedback.message).toBe('Z! Corra até o portal!');
    expect(game.progress.recordSpeedrunTime).not.toHaveBeenCalled();

    walkIntoPortal(scene);
    scene.update(2);
    expect(game.progress.recordSpeedrunTime).toHaveBeenCalledWith('p1', expect.any(Number));
    expect(game.scenes.switchTo).toHaveBeenCalledWith('victory', expect.objectContaining({ mode: 'speedrun' }));
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

function preferences({ supportLevel = 'standard', reducedMotion = false } = {}) {
  return {
    supportLevel: () => supportLevel,
    reducedMotion: () => reducedMotion,
    largeText: () => false,
    highContrast: () => false,
  };
}

function makeNarrator() {
  return {
    speak: vi.fn(),
    speakPraise: vi.fn(),
    speakLessonTarget: vi.fn(),
    speakWordTarget: vi.fn(),
    stop: vi.fn(),
  };
}

describe('GameScene terminal states and metrics', () => {
  it('stops the marathon clock when the player enters the portal: the exit animation never counts', () => {
    const game = makeFakeGame();
    const scene = enterSpeedrun(game);
    scene.speedrun.currentIndex = 25;
    scene.lesson = { id: 'alfabeto-z', target: 'Z', objective: 'Colete a letra Z' };
    scene.validator = new AnswerValidator(scene.lesson);
    scene.stream.setTarget('Z');
    collectTarget(scene);

    walkIntoPortal(scene);
    expect(scene.status).toBe('won');
    const frozen = scene.speedrunElapsed;
    scene.update(1);
    expect(scene.speedrunElapsed).toBe(frozen);
  });

  it('excludes paused time from the marathon clock', () => {
    const scene = enterSpeedrun(makeFakeGame());
    scene.update(0.5);
    const before = scene.speedrunElapsed;
    scene.pause();
    scene.update(3);
    expect(scene.speedrunElapsed).toBe(before);
  });

  it('ignores hazards and heart loss once the run is over', () => {
    const game = makeFakeGame();
    const scene = enterNormalLesson(game);
    collectTarget(scene);
    walkIntoPortal(scene);
    expect(scene.status).toBe('won');
    const lives = scene.lives.lives;

    scene.onHazardHit();
    game.bus.emit(Events.LIVES_DEPLETED, {});

    expect(scene.lives.lives).toBe(lives);
    expect(scene.status).toBe('won');
    expect(game.menu.showGameOver).not.toHaveBeenCalled();
  });

  it('does not charge a heart for hazards on the way to the portal, only sends the player back', () => {
    const scene = enterNormalLesson(makeFakeGame());
    collectTarget(scene);
    expect(scene.portalOpen).toBe(true);
    const respawn = vi.spyOn(scene, 'respawn');

    scene.onHazardHit();

    expect(scene.lives.lives).toBe(scene.lives.maxLives);
    expect(respawn).toHaveBeenCalledTimes(1);
  });

  it('ignores any collection after the objective is done, so a leftover letter cannot cost the phase', () => {
    const scene = enterNormalLesson(makeFakeGame());
    const distractor = scene.level.items.find((item) => item.type === 'distractor');
    collectTarget(scene);
    scene.lives.loseHeart();
    scene.lives.loseHeart();

    scene.onItemCollected(distractor);

    expect(scene.mistakes).toBe(0);
    expect(scene.lives.lives).toBe(1);
    expect(scene.status).toBe('running');
  });

  it('emits the victory only once, even if the portal is reported twice', () => {
    const game = makeFakeGame();
    const scene = enterNormalLesson(game);
    collectTarget(scene);
    walkIntoPortal(scene);
    scene.onPortalEntered();
    scene.winLevel({ viaPortal: true });
    scene.update(3);
    scene.update(3);
    expect(game.scenes.switchTo).toHaveBeenCalledTimes(1);
  });

  it('pops the distractors the stream withdrew on the screen', () => {
    const game = makeFakeGame();
    const scene = enterNormalLesson(game);
    const visible = scene.level.items.find((item) => item.type === 'distractor');
    scene.camera.x = visible.x - 100;
    game.effects.spawnPuff.mockClear();

    collectTarget(scene);

    expect(game.effects.spawnPuff).toHaveBeenCalledWith(visible.x + visible.w / 2, visible.y + visible.h / 2, 10, '#ffffff');
  });
});

describe('GameScene support levels', () => {
  it('assisted: a wrong letter counts as a mistake but costs no heart', () => {
    const scene = enterExplore(makeFakeGame({ preferences: preferences({ supportLevel: 'assisted' }) }));
    const distractor = scene.level.items.find((item) => item.type === 'distractor');
    scene.onItemCollected(distractor);
    expect(scene.mistakes).toBe(1);
    expect(scene.lives.lives).toBe(scene.lives.maxLives);
  });

  it('assisted: hazards still cost a heart (motor difficulty is not a reading mistake)', () => {
    const scene = enterNormalLesson(makeFakeGame({ preferences: preferences({ supportLevel: 'assisted' }) }));
    scene.onHazardHit();
    expect(scene.lives.lives).toBe(scene.lives.maxLives - 1);
  });

  it('standard and challenge: a wrong letter costs a heart', () => {
    for (const supportLevel of ['standard', 'challenge']) {
      const scene = enterExplore(makeFakeGame({ preferences: preferences({ supportLevel }) }));
      scene.onItemCollected(scene.level.items.find((item) => item.type === 'distractor'));
      expect(scene.lives.lives, supportLevel).toBe(scene.lives.maxLives - 1);
    }
  });

  it('assisted: names the off-screen letter at the screen edge', () => {
    const scene = enterExplore(makeFakeGame({ preferences: preferences({ supportLevel: 'assisted' }) }));
    scene.update(0.016);
    const target = scene.stream.liveTarget;
    const onScreen = target.x <= scene.camera.x + scene.camera.viewport.width;
    expect(scene.hudModel.targetPointer).toEqual(onScreen ? null : { direction: 'right', label: 'G' });

    const standard = enterExplore(makeFakeGame());
    standard.update(0.016);
    expect(standard.hudModel.targetPointer).toBeNull();
  });

  it('assisted: repeats the instruction after a while without progress', () => {
    const narrator = makeNarrator();
    const scene = enterExplore(makeFakeGame({ narrator, preferences: preferences({ supportLevel: 'assisted' }) }));
    narrator.speakWordTarget.mockClear();
    for (let i = 0; i < 11 * 60; i += 1) scene.update(1 / 60);
    expect(narrator.speakWordTarget).toHaveBeenCalledWith('GATO');
    expect(narrator.speak).toHaveBeenCalledWith('Agora a letra g', { interrupt: false });
  });

  it('builds the next run with the policy distractor count', () => {
    const game = makeFakeGame({ preferences: preferences({ supportLevel: 'challenge' }) });
    const scene = new GameScene(game);
    scene.enter({ mode: 'speedrun' });
    expect(scene.support.allowNeighbourLetters).toBe(true);
    expect(scene.support.distractorsPerSegment).toBe(4);
  });
});

describe('GameScene narration and accessibility', () => {
  it('forwards the letter target to the narrator on start, manual and assisted repeats', () => {
    const narrator = makeNarrator();
    const game = makeFakeGame({ narrator, preferences: preferences({ supportLevel: 'assisted' }) });
    const scene = enterNormalLesson(game, 'alfabeto-a');
    expect(narrator.speakLessonTarget).toHaveBeenCalledWith('A', 'letter');

    narrator.speakLessonTarget.mockClear();
    game.hudControls.showPauseButton.mock.calls[0][0].onRepeat();
    expect(narrator.speakLessonTarget).toHaveBeenCalledWith('A', 'letter');

    narrator.speakLessonTarget.mockClear();
    for (let i = 0; i < 11 * 60; i += 1) scene.update(1 / 60);
    expect(narrator.speakLessonTarget).toHaveBeenCalledWith('A', 'letter');
  });

  it('queues the next marathon letter after the praise', () => {
    const narrator = makeNarrator();
    const scene = enterSpeedrun(makeFakeGame({ narrator }));
    narrator.speakLessonTarget.mockClear();
    collectTarget(scene);
    expect(narrator.speakLessonTarget).toHaveBeenCalledWith('B', 'letter', { interrupt: false });
  });

  it('offers "ouvir novamente" in the HUD, speaking the current instruction', () => {
    const narrator = makeNarrator();
    const game = makeFakeGame({ narrator });
    const scene = enterExplore(game);
    collectTarget(scene);
    const { onRepeat } = game.hudControls.showPauseButton.mock.calls[0][0];
    narrator.speakWordTarget.mockClear();
    narrator.speak.mockClear();

    onRepeat();

    expect(narrator.speakWordTarget).toHaveBeenCalledWith('GATO');
    expect(narrator.speak).toHaveBeenCalledWith('Agora a letra a', { interrupt: false });
  });

  it('queues the next letter and the finished word after the praise instead of cutting it off', () => {
    const narrator = makeNarrator();
    const scene = enterExplore(makeFakeGame({ narrator }));
    collectTarget(scene);
    expect(narrator.speakPraise).toHaveBeenCalled();
    expect(narrator.speak).toHaveBeenCalledWith('Agora a letra a', { interrupt: false });

    for (let i = 0; i < 3; i += 1) collectTarget(scene);
    expect(narrator.speak).toHaveBeenLastCalledWith(
      'Você montou a palavra gato! O portal abriu, corra até ele!',
      { interrupt: false },
    );
  });

  it('challenge: does not narrate the next letter', () => {
    const narrator = makeNarrator();
    const scene = enterExplore(makeFakeGame({ narrator, preferences: preferences({ supportLevel: 'challenge' }) }));
    collectTarget(scene);
    expect(narrator.speak).not.toHaveBeenCalledWith('Agora a letra a', expect.anything());
  });

  it('mirrors objective and feedback to the screen-reader announcer', () => {
    const announcer = { announce: vi.fn(), reset: vi.fn() };
    const scene = enterExplore(makeFakeGame({ announcer }));
    expect(announcer.reset).toHaveBeenCalled();
    expect(announcer.announce).toHaveBeenCalledWith('Monte a palavra: GATO');
    collectTarget(scene);
    expect(announcer.announce).toHaveBeenCalledWith('Boa! Agora a letra A!');
  });

  it('reduced motion: no shake, no suction, no flash on the portal', () => {
    const game = makeFakeGame({ preferences: preferences({ reducedMotion: true }) });
    const scene = enterExplore(game);
    for (let i = 0; i < 4; i += 1) collectTarget(scene);
    expect(scene._shake).toBe(0);

    walkIntoPortal(scene);
    expect(scene.status).toBe('won');
    expect(game.effects.spawnSuction).not.toHaveBeenCalled();
    const bodyX = scene.player.body.x;
    scene.update(0.5);
    expect(scene.player.body.x).toBe(bodyX);
    expect(scene._flashAlpha).toBe(0);
    scene.update(0.5);
    expect(game.scenes.switchTo).toHaveBeenCalledWith('victory', expect.objectContaining({ mode: 'explore' }));
  });
});

describe('journey retry', () => {
  it('keeps earlier words after defeat and still shows the current word image', () => {
    const game = makeFakeGame({ startExploration: vi.fn() });
    const word = WORD_BANK.find(entry => entry.id === 'gato');
    const scene = new GameScene(game);
    scene.enter({ mode: 'explore', exploreRun: new ExploreRun(word, undefined, 0, ['sol', 'bola']) });
    expect(game.hudControls.showPauseButton).toHaveBeenCalledWith(expect.objectContaining({ word, journeyLabel: 'Palavra 3 de 3' }));
    scene.restart();
    expect(game.startExploration).toHaveBeenCalledWith('gato', ['sol', 'bola']);
  });
});
