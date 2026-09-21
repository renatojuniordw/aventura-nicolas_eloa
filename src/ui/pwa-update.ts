/**
 * PWA update flow. A new service worker is downloaded in the background and
 * left waiting (registerType 'prompt'); this module decides WHEN it is safe
 * to activate it and reload — never while a level is being played.
 *
 *  - Update found: show a "new version" banner outside gameplay.
 *  - Back on the menu (i.e. between levels) or app sent to background while
 *    not playing: apply it automatically.
 */
import { Events, type EventBus } from '../core/event-bus.js';

/** Scene during which a reload would lose the player's run. */
const PLAYING_SCENE = 'game';
const MENU_SCENE = 'menu';
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export interface UpdateBanner {
  setVisible(visible: boolean): void;
}

export interface UpdateControllerDeps {
  bus: EventBus;
  getSceneName: () => string | null;
  /** Activates the waiting service worker and reloads the page. */
  applyUpdate: () => void;
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
    this._syncBanner(this._deps.getSceneName());
  }

  /** The page was hidden (app minimised, tab switched, phone locked). */
  onHidden(): void {
    if (this._pending && this._deps.getSceneName() !== PLAYING_SCENE) this.apply();
  }

  /** Manual "Atualizar" tap. */
  apply(): void {
    if (!this._pending || this._applying) return;
    this._applying = true;
    this._deps.banner.setVisible(false);
    this._deps.applyUpdate();
  }

  private _syncBanner(sceneName: string | null): void {
    this._deps.banner.setVisible(this._pending && sceneName !== PLAYING_SCENE);
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
        if (navigator.onLine) void registration.update().catch(() => {});
      };
      setInterval(check, CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
    },
  });
  controller = new UpdateController({
    bus: game.bus,
    getSceneName: () => game.scenes.currentName,
    applyUpdate: () => void updateSW(true),
    banner,
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) controller.onHidden();
  });
}
