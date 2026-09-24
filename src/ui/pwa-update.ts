/**
 * PWA update flow. A new service worker is downloaded in the background and
 * left waiting (registerType 'prompt'); this module decides WHEN it is safe
 * to activate it and reload — never while a level is being played.
 *
 *  - Update found in the menu: activate and reload; otherwise show a banner outside gameplay.
 *  - Back on the menu (i.e. between levels) or app sent to background while
 *    not playing: apply it automatically.
 */
import { Events, type EventBus } from '../core/event-bus.js';

/** Scene during which a reload would lose the player's run. */
const isPlayingScene = (name: string | null) => name === 'game' || name === 'exploration';
const MENU_SCENE = 'menu';
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export interface UpdateBanner {
  setVisible(visible: boolean): void;
}

export interface UpdateControllerDeps {
  bus: EventBus;
  getSceneName: () => string | null;
  /** Activates the waiting service worker and reloads the page. */
  applyUpdate: () => void | Promise<void>;
  banner: UpdateBanner;
}

export class UpdateController {
  private _pending = false;
  private _applying = false;

  constructor(private readonly _deps: UpdateControllerDeps) {
    _deps.bus.on(Events.SCENE_CHANGED, ({ name }) => {
      if (this._pending && name === MENU_SCENE) this.apply();
      else this._syncBanner(name);
    });
  }

  get pending(): boolean {
    return this._pending;
  }

  /** A new version finished downloading and is waiting to activate. */
  onUpdateReady(): void {
    this._pending = true;
    if (this._deps.getSceneName() === MENU_SCENE) this.apply();
    else this._syncBanner(this._deps.getSceneName());
  }

  /** The page was hidden (app minimised, tab switched, phone locked). */
  onHidden(): void {
    if (this._pending && !isPlayingScene(this._deps.getSceneName())) this.apply();
  }

  /** Manual "Atualizar" tap. */
  apply(): void {
    if (!this._pending || this._applying || isPlayingScene(this._deps.getSceneName())) return;
    this._applying = true;
    this._deps.banner.setVisible(false);
    const retry = () => {
      this._applying = false;
      this._syncBanner(this._deps.getSceneName());
    };
    try {
      Promise.resolve(this._deps.applyUpdate()).catch(retry);
    } catch {
      retry();
    }
  }

  private _syncBanner(sceneName: string | null): void {
    this._deps.banner.setVisible(this._pending && !this._applying && !isPlayingScene(sceneName));
  }
}

/** Fixed bottom banner: message plus an "Atualizar" button. */
export function createUpdateBanner(onApply: () => void): UpdateBanner {
  const el = document.createElement('div');
  el.className = 'update-banner';
  el.setAttribute('role', 'status');
  el.hidden = true;

  const text = document.createElement('span');
  text.textContent = 'Nova versão disponível!';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Atualizar';
  button.addEventListener('click', onApply);

  el.append(text, button);
  document.body.appendChild(el);
  return { setVisible: (visible) => void (el.hidden = !visible) };
}

/** Registers the service worker and wires the update flow. Browser only. */
export async function initPwaUpdates(game: {
  bus: EventBus;
  scenes: { currentName: string | null };
}): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');

  let controller: UpdateController;
  const banner = createUpdateBanner(() => controller.apply());
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => controller.onUpdateReady(),
    onRegisteredSW: (_url, registration) => {
      if (!registration) return;
      // A long-lived PWA is rarely cold-started, so poll for new versions.
      const check = () => {
        if (navigator.onLine && !registration.installing) void registration.update().catch(() => {});
      };
      check();
      setInterval(check, CHECK_INTERVAL_MS);
      window.addEventListener('online', check);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
    },
  });
  controller = new UpdateController({
    bus: game.bus,
    getSceneName: () => game.scenes.currentName,
    applyUpdate: () => updateSW(true),
    banner,
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) controller.onHidden();
  });
}
