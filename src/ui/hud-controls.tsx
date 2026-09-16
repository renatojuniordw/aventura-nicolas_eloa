import { mountScreen } from './screens/mount-screen.js';
import { clear } from './dom.js';

interface PauseButtonOptions {
  onPause: () => void;
}

function PauseButton({ onPause }: PauseButtonOptions) {
  return (
    <button
      className="pause-btn"
      type="button"
      tabIndex={-1}
      aria-label="Pausar"
      onClick={(event) => {
        event.currentTarget.blur();
        onPause();
      }}
    >
      ⏸
    </button>
  );
}

interface HudControlsOptions {
  root: HTMLElement;
}

/**
 * Persistent DOM control drawn on top of the canvas but below the modal
 * overlay layer, e.g. a visible pause button. Unlike MenuOverlay, this stays
 * mounted for the lifetime of a scene rather than being replaced per screen.
 *
 * Uses `mountScreen` (the same helper the modal screens use) rather than
 * rendering directly into `root`: `root` can be the *same* DOM element as
 * `MenuOverlay`'s root when the app is wired without a dedicated
 * `hudControlsRoot` (see `main.ts`'s `hudControlsRoot ?? overlayRoot`
 * fallback, exercised by `integration.test.js`) — `MenuOverlay.hide()`/`
 * _mount()` clearing that shared element would otherwise detach this
 * button's DOM node without React knowing, and a later
 * `hidePauseButton()` would throw trying to unmount it.
 */
export class HudControls {
  private _root: HTMLElement;
  private _current: { node: HTMLElement; cleanup: () => void } | null = null;

  constructor({ root }: HudControlsOptions) {
    this._root = root;
  }

  showPauseButton({ onPause }: PauseButtonOptions): void {
    this._current?.cleanup();
    const { node, cleanup } = mountScreen(<PauseButton onPause={onPause} />);
    clear(this._root);
    this._root.append(node);
    this._current = { node, cleanup };
  }

  hidePauseButton(): void {
    this._current?.cleanup();
    this._current = null;
    clear(this._root);
  }
}
