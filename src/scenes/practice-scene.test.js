import { describe, expect, it, vi } from 'vitest';
import { PracticeScene } from './practice-scene.js';
import { Actions } from '../input/actions.js';

function makeGame({ isTouch = true } = {}) {
  const held = new Set();
  const pressed = new Set();
  return {
    held,
    pressed,
    input: {
      reset: vi.fn(),
      getMoveAxis: () => (held.has(Actions.MOVE_RIGHT) ? 1 : 0) - (held.has(Actions.MOVE_LEFT) ? 1 : 0),
      isActionHeld: (action) => held.has(action),
      consumePressed: (action) => pressed.delete(action),
    },
    bus: { emit: vi.fn() },
    device: { isTouch },
    profiles: { getActiveProfile: () => null },
    assets: { load: vi.fn(() => Promise.resolve()) },
    touchControls: { show: vi.fn(), hide: vi.fn(), setHints: vi.fn() },
    hudControls: { showPracticeCoach: vi.fn(), hidePauseButton: vi.fn() },
    narrator: { speak: vi.fn(), stop: vi.fn() },
    controlsPractice: { markOffered: vi.fn(), markCompleted: vi.fn() },
    progress: { resetProgress: vi.fn(), markComplete: vi.fn() },
    scenes: { switchTo: vi.fn() },
    sprites: { drawPlayer: vi.fn() },
  };
}

const run = (scene, seconds) => {
  for (let t = 0; t < seconds; t += 1 / 60) scene.update(1 / 60);
};

describe('PracticeScene (docs/18 §8)', () => {
  it('advances on real gestures through the real player, then remembers completion', () => {
    const game = makeGame();
    const onExit = vi.fn();
    const scene = new PracticeScene(game);
    scene.enter({ onExit });
    run(scene, 0.5); // settle on the floor
    expect(game.touchControls.show).toHaveBeenCalled();
    expect(game.bus.emit).toHaveBeenCalledWith('input.mode.changed', { playing: true });
    expect(game.hudControls.showPracticeCoach.mock.lastCall[0].title).toBe('Andar');

    game.held.add(Actions.MOVE_RIGHT);
    run(scene, 0.6);
    game.held.delete(Actions.MOVE_RIGHT);
    expect(scene.practice.step).toBe('jump');
    expect(game.touchControls.setHints).toHaveBeenLastCalledWith([Actions.JUMP]);

    // The step completes when the character actually takes off, not on the press itself.
    game.pressed.add(Actions.JUMP);
    run(scene, 1.2);
    expect(scene.practice.step).toBe('combo');

    game.held.add(Actions.MOVE_LEFT);
    game.pressed.add(Actions.JUMP);
    run(scene, 0.2);
    expect(scene.practice.done).toBe(true);
    const coach = game.hudControls.showPracticeCoach.mock.lastCall[0];
    expect(coach.done).toBe(true);

    coach.onFinish();
    expect(game.controlsPractice.markCompleted).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledOnce();
    // Practice never touches learning progress.
    expect(game.progress.resetProgress).not.toHaveBeenCalled();
    expect(game.progress.markComplete).not.toHaveBeenCalled();
  });

  it('can be skipped at any step without marking completion', () => {
    const game = makeGame();
    const onExit = vi.fn();
    const scene = new PracticeScene(game);
    scene.enter({ onExit });
    game.hudControls.showPracticeCoach.mock.lastCall[0].onSkip();
    game.hudControls.showPracticeCoach.mock.lastCall[0].onSkip();
    expect(onExit).toHaveBeenCalledOnce();
    expect(game.controlsPractice.markCompleted).not.toHaveBeenCalled();
    expect(game.controlsPractice.markOffered).toHaveBeenCalledOnce();
  });

  it('leaves on Pause/Back and cleans up the controls and coach', () => {
    const game = makeGame({ isTouch: false });
    const scene = new PracticeScene(game);
    scene.enter({});
    expect(game.touchControls.show).not.toHaveBeenCalled();
    expect(game.hudControls.showPracticeCoach.mock.lastCall[0].body).toContain('←');
    game.pressed.add(Actions.PAUSE);
    scene.update(1 / 60);
    expect(game.scenes.switchTo).toHaveBeenCalledWith('menu');
    scene.exit();
    expect(game.hudControls.hidePauseButton).toHaveBeenCalled();
    expect(game.touchControls.hide).toHaveBeenCalled();
    expect(game.bus.emit).toHaveBeenLastCalledWith('input.mode.changed', { playing: false });
  });
});
