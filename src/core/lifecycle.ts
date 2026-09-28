import { Events, type EventBus } from './event-bus.js';

/**
 * Wires the page's lifecycle to the game: losing focus (blur, hidden tab)
 * releases held input and announces APP_BLURRED so the game can pause, and
 * coming back announces APP_FOCUSED. The first tap of the session also unlocks
 * audio — mobile browsers block Audio.play() outside a user gesture, so this
 * runs on whichever element the tap lands on, and every playMusic/playSfx call
 * afterwards just works. Losing focus also silences effects in flight, so a
 * sound never keeps playing behind a hidden tab or resumes out of context.
 */
export function registerLifecycleListeners({
  bus,
  input,
  audio,
}: {
  bus: EventBus;
  input: { reset(): void };
  audio: { unlock(): void; stopSfx?(): void };
}): void {
  const handleBlur = () => {
    input.reset();
    audio.stopSfx?.();
    bus.emit(Events.APP_BLURRED);
  };
  window.addEventListener('blur', handleBlur);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handleBlur();
    else bus.emit(Events.APP_FOCUSED);
  });
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
}
