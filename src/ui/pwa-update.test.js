import { describe, it, expect, vi } from 'vitest';
import { EventBus, Events } from '../core/event-bus.js';
import { UpdateController } from './pwa-update.js';

function setup(scene = 'menu') {
  const bus = new EventBus();
  const state = { scene, phoneSession: false };
  const applyUpdate = vi.fn();
  const banner = { setVisible: vi.fn() };
  const controller = new UpdateController({
    bus,
    getSceneName: () => state.scene,
    applyUpdate,
    banner,
    isPhoneSessionActive: () => state.phoneSession,
  });
  const go = (name) => {
    state.scene = name;
    bus.emit(Events.SCENE_CHANGED, { name });
  };
  const setPhoneSession = (active) => {
    state.phoneSession = active;
    bus.emit(Events.PHONE_LINK_CHANGED, { session: active, paired: active, operational: active });
  };
  return { controller, applyUpdate, banner, go, setPhoneSession };
}

describe('UpdateController', () => {
  it('shows a ready indicator when an update arrives in the menu', () => {
    const { controller, applyUpdate, banner } = setup('menu');
    controller.onUpdateReady();
    expect(banner.setVisible).toHaveBeenLastCalledWith(true);
    expect(applyUpdate).not.toHaveBeenCalled();
  });

  it('never shows or applies while playing, then offers it back on the menu', () => {
    const { controller, applyUpdate, banner, go } = setup('game');
    controller.onUpdateReady();
    expect(banner.setVisible).toHaveBeenLastCalledWith(false);
    controller.onHidden();
    expect(applyUpdate).not.toHaveBeenCalled();
    go('menu');
    expect(applyUpdate).not.toHaveBeenCalled();
    expect(banner.setVisible).toHaveBeenLastCalledWith(true);
  });

  it('also preserves a free Explorar session (it runs inside the game scene) until the menu', () => {
    const { controller, applyUpdate, go } = setup('game');
    controller.onUpdateReady();
    controller.apply();
    expect(applyUpdate).not.toHaveBeenCalled();
    go('menu');
    expect(applyUpdate).not.toHaveBeenCalled();
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
  controller.apply();
  expect(applyUpdate).not.toHaveBeenCalled();
});

it('allows retry after a rejected activation', async () => {
  const { controller, applyUpdate, banner } = setup('menu');
  applyUpdate.mockRejectedValueOnce(new Error('offline'));
  controller.onUpdateReady();
  controller.apply();
  await Promise.resolve();
  expect(banner.setVisible).toHaveBeenLastCalledWith(true);
  controller.apply();
  expect(applyUpdate).toHaveBeenCalledTimes(2);
});

describe('UpdateController and phone control', () => {
  it('waits while a phone is paired (QR screen, menu or pause), then offers it when the session ends', () => {
    const { controller, applyUpdate, banner, setPhoneSession } = setup('menu');
    setPhoneSession(true);
    controller.onUpdateReady();
    expect(banner.setVisible).toHaveBeenLastCalledWith(false);
    controller.onHidden();
    controller.apply();
    expect(applyUpdate).not.toHaveBeenCalled();

    setPhoneSession(false);
    expect(banner.setVisible).toHaveBeenLastCalledWith(true);
    controller.onHidden();
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('entering the menu never reloads by itself', () => {
    const { controller, applyUpdate, go } = setup('game');
    controller.onUpdateReady();
    go('menu');
    expect(applyUpdate).not.toHaveBeenCalled();
  });
});
