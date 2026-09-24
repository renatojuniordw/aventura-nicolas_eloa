import { describe, it, expect, vi } from 'vitest';
import { VictoryScene } from './victory-scene.js';
import { Actions } from '../input/actions.js';

function makeFakeGame(overrides = {}) {
  return {
    profiles: { getActiveProfile: vi.fn(() => ({ id: 'p1', characterId: 'char-nicolas' })) },
    curriculum: {
      getLesson: vi.fn((id) => ({ id, target: 'A', objective: 'Encontre A', title: 'Letra A' })),
      lessonOrder: ['alfabeto-a', 'alfabeto-b'],
    },
    progress: {
      getNextLesson: vi.fn(() => 'alfabeto-b'),
    },
    effects: {
      spawnConfetti: vi.fn(),
      update: vi.fn(),
      clear: vi.fn(),
      draw: vi.fn(),
    },
    renderer: { width: 960, setCamera: vi.fn(), clear: vi.fn() },
    menu: {
      showSpeedrunVictory: vi.fn(),
      showVictory: vi.fn(),
      showExploreVictory: vi.fn(),
      hide: vi.fn(),
    },
    input: {
      consumePressed: vi.fn(() => false),
    },
    scenes: { switchTo: vi.fn() },
    startSpeedrun: vi.fn(),
    startLesson: vi.fn(),
    startExploration: vi.fn(),
    ...overrides,
  };
}

describe('VictoryScene', () => {
  it('shows speedrun results when mode is speedrun', () => {
    const game = makeFakeGame();
    const scene = new VictoryScene(game);
    scene.enter({
      mode: 'speedrun',
      elapsed: 35.2,
      mistakes: 2,
      isNewBest: true,
      bestTime: 40,
      totalLetters: 26,
    });

    expect(game.menu.showSpeedrunVictory).toHaveBeenCalledTimes(1);
    const opts = game.menu.showSpeedrunVictory.mock.calls[0][0];
    expect(opts.elapsed).toBe(35.2);
    expect(opts.mistakes).toBe(2);
    expect(opts.isNewBest).toBe(true);
    expect(opts.bestTime).toBe(40);
    expect(opts.totalLetters).toBe(26);
    expect(typeof opts.onReplay).toBe('function');
    expect(typeof opts.onMenu).toBe('function');
    expect(game.effects.spawnConfetti).toHaveBeenCalledWith(480, 140, 96);
  });

  it('shows normal victory screen when mode is normal', () => {
    const game = makeFakeGame();
    const scene = new VictoryScene(game);
    scene.enter({
      lessonId: 'alfabeto-a',
      stars: 3,
      mistakes: 0,
    });

    expect(game.menu.showVictory).toHaveBeenCalledTimes(1);
    const opts = game.menu.showVictory.mock.calls[0][0];
    expect(opts.stars).toBe(3);
    expect(opts.mistakes).toBe(0);
    expect(opts.hasNext).toBe(true);
    expect(typeof opts.onNext).toBe('function');
    expect(typeof opts.onReplay).toBe('function');
    expect(typeof opts.onMenu).toBe('function');
    expect(game.effects.spawnConfetti).toHaveBeenCalledWith(480, 140, 64);
  });

  it('sets hasNext to false when next lesson is the same as current', () => {
    const game = makeFakeGame({
      progress: { getNextLesson: vi.fn(() => 'alfabeto-a') },
    });
    const scene = new VictoryScene(game);
    scene.enter({ lessonId: 'alfabeto-a' });

    expect(game.menu.showVictory.mock.calls[0][0].hasNext).toBe(false);
  });

  it('sets hasNext to false when there is no active profile (no progress)', () => {
    const game = makeFakeGame({
      profiles: { getActiveProfile: vi.fn(() => null) },
    });
    const scene = new VictoryScene(game);
    scene.enter({ lessonId: 'alfabeto-a' });

    expect(game.menu.showVictory.mock.calls[0][0].hasNext).toBe(false);
  });

  it('wires onReplay to startSpeedrun in speedrun mode', () => {
    const game = makeFakeGame();
    const scene = new VictoryScene(game);
    scene.enter({ mode: 'speedrun' });

    game.menu.showSpeedrunVictory.mock.calls[0][0].onReplay();
    expect(game.startSpeedrun).toHaveBeenCalledTimes(1);
  });

  it('wires onMenu to switchTo menu in speedrun mode', () => {
    const game = makeFakeGame();
    const scene = new VictoryScene(game);
    scene.enter({ mode: 'speedrun' });

    game.menu.showSpeedrunVictory.mock.calls[0][0].onMenu();
    expect(game.scenes.switchTo).toHaveBeenCalledWith('menu');
  });

  it('shows the word victory with a next phase and wires its buttons in explore mode', () => {
    const game = makeFakeGame({ progress: { getNextLesson: vi.fn(() => 'palavra-bola') } });
    const scene = new VictoryScene(game);
    scene.enter({ mode: 'explore', wordId: 'gato', stars: 2, mistakes: 1 });

    const opts = game.menu.showExploreVictory.mock.calls[0][0];
    expect(opts.word).toBe('GATO');
    expect(opts.stars).toBe(2);
    expect(opts.hasNext).toBe(true);

    opts.onNext();
    expect(game.startExploration).toHaveBeenCalledWith('bola');
    opts.onReplay();
    expect(game.startExploration).toHaveBeenCalledWith('gato');
    opts.onMenu();
    expect(game.scenes.switchTo).toHaveBeenCalledWith('menu');
  });

  it('has no next phase once the trail is finished or only the same word is left', () => {
    for (const next of [null, 'palavra-gato']) {
      const game = makeFakeGame({ progress: { getNextLesson: vi.fn(() => next) } });
      new VictoryScene(game).enter({ mode: 'explore', wordId: 'gato' });
      expect(game.menu.showExploreVictory.mock.calls[0][0].hasNext).toBe(false);
    }
  });

  it('wires onNext to startLesson in normal mode', () => {
    const game = makeFakeGame();
    const scene = new VictoryScene(game);
    scene.enter({ lessonId: 'alfabeto-a' });

    game.menu.showVictory.mock.calls[0][0].onNext();
    expect(game.startLesson).toHaveBeenCalledWith('alfabeto-b');
  });

  it('wires onReplay to startLesson with the same lessonId in normal mode', () => {
    const game = makeFakeGame();
    const scene = new VictoryScene(game);
    scene.enter({ lessonId: 'alfabeto-a' });

    game.menu.showVictory.mock.calls[0][0].onReplay();
    expect(game.startLesson).toHaveBeenCalledWith('alfabeto-a');
  });

  it('clears effects and hides menu on exit', () => {
    const game = makeFakeGame();
    const scene = new VictoryScene(game);
    scene.exit();

    expect(game.menu.hide).toHaveBeenCalledTimes(1);
    expect(game.effects.clear).toHaveBeenCalledTimes(1);
  });

  it('delegates update to effects and forwards CONFIRM/BACK actions', () => {
    const game = makeFakeGame({
      input: {
        consumePressed: vi.fn((action) => {
          if (action === Actions.CONFIRM) return true;
          return false;
        }),
        isActionHeld: vi.fn(() => false),
      },
    });
    const scene = new VictoryScene(game);
    scene.enter({ lessonId: 'alfabeto-a' });

    game.menu.triggerPrimary = vi.fn();
    game.menu.triggerBack = vi.fn();

    scene.update(0.016);

    expect(game.effects.update).toHaveBeenCalledWith(0.016);
    expect(game.menu.triggerPrimary).toHaveBeenCalledTimes(1);
    expect(game.menu.triggerBack).not.toHaveBeenCalled();
  });

  it('draws sky background with effects rendered in screen space', () => {
    const game = makeFakeGame();
    const renderer = { clear: vi.fn(), setCamera: vi.fn() };
    const scene = new VictoryScene(game);
    scene.draw(renderer);

    expect(renderer.clear).toHaveBeenCalledTimes(1);
    expect(renderer.setCamera).toHaveBeenCalledWith(0, 0);
    expect(game.effects.draw).toHaveBeenCalledWith(renderer);
  });
});