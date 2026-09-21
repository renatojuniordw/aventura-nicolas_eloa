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
  it('shows the banner on the menu without reloading', () => {
    const { controller, applyUpdate, banner } = setup('menu');
    controller.onUpdateReady();
    expect(banner.setVisible).toHaveBeenLastCalledWith(true);
    expect(applyUpdate).not.toHaveBeenCalled();
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

  it('applies when hidden outside gameplay', () => {
    const { controller, applyUpdate } = setup('menu');
    controller.onUpdateReady();
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
