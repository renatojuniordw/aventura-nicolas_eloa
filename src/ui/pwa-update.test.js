import { describe, it, expect, vi } from 'vitest';
import { EventBus, Events } from '../core/event-bus.js';
import { UpdateController } from './pwa-update.js';

function setup(scene = 'menu') {
  const bus = new EventBus();
  const state = { scene };
  const applyUpdate = vi.fn();
  const banner = { setVisible: vi.fn() };
  const controller = new UpdateController({ bus, getSceneName: () => state.scene, applyUpdate, banner });
  const go = (name) => {
    state.scene = name;
    bus.emit(Events.SCENE_CHANGED, { name });
  };
  return { controller, applyUpdate, banner, go };
}

describe('UpdateController', () => {
  it('applies immediately when an update arrives in the menu', () => {
    const { controller, applyUpdate, banner } = setup('menu');
    controller.onUpdateReady();
    expect(banner.setVisible).toHaveBeenLastCalledWith(false);
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('never shows or applies while playing, then applies back on the menu', () => {
    const { controller, applyUpdate, banner, go } = setup('game');
    controller.onUpdateReady();
    expect(banner.setVisible).toHaveBeenLastCalledWith(false);
    controller.onHidden();
    expect(applyUpdate).not.toHaveBeenCalled();
    go('menu');
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('also preserves a free exploration session until the menu', () => {
    const { controller, applyUpdate, go } = setup('exploration');
    controller.onUpdateReady();
    controller.apply();
    expect(applyUpdate).not.toHaveBeenCalled();
    go('menu');
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('applies when hidden outside gameplay', () => {
    const { controller, applyUpdate } = setup('victory');
    controller.onUpdateReady();
    expect(applyUpdate).not.toHaveBeenCalled();
    controller.onHidden();
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('applies at most once and ignores apply with nothing pending', () => {
    const { controller, applyUpdate } = setup('menu');
    controller.apply();
    expect(applyUpdate).not.toHaveBeenCalled();
    controller.onUpdateReady();
    controller.apply();
    controller.apply();
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('shows the banner again when leaving the game for the victory screen', () => {
    const { controller, banner, go } = setup('game');
    controller.onUpdateReady();
    go('victory');
    expect(banner.setVisible).toHaveBeenLastCalledWith(true);
  });
});

it('does not reload a game even if apply is invoked directly', () => {
  const { controller, applyUpdate } = setup('game');
  controller.onUpdateReady();
  controller.apply();
  expect(applyUpdate).not.toHaveBeenCalled();
});

it('allows retry after a rejected activation', async () => {
  const { controller, applyUpdate, banner } = setup('menu');
  applyUpdate.mockRejectedValueOnce(new Error('offline'));
  controller.onUpdateReady();
  await Promise.resolve();
  expect(banner.setVisible).toHaveBeenLastCalledWith(true);
  controller.apply();
  expect(applyUpdate).toHaveBeenCalledTimes(2);
});
