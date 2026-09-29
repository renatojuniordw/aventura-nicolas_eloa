import { WordPicture } from './screens/word-picture.js';
import type { WordEntry } from '../content/word-bank.js';
import { mountScreen } from './screens/mount-screen.js';
import { clear } from './dom.js';

import { useState, useEffect } from 'react';
import { isFullscreenSupported, isFullscreen, toggleFullscreen, onFullscreenChange } from './fullscreen.js';

interface PauseButtonOptions {
  onPause: () => void;
  onRepeat?: () => void;
  /** Progressive hint; distinct from repeating the audio (docs/20 §4 L2). */
  onHint?: () => void;
  word?: WordEntry;
  journeyLabel?: string;
}

function HudControlsBar({ onPause, onRepeat, onHint, word, journeyLabel }: PauseButtonOptions) {
  const [fullscreen, setFullscreen] = useState(() => isFullscreen());
  const supported = isFullscreenSupported();

  useEffect(() => {
    return onFullscreenChange((active) => setFullscreen(active));
  }, []);

  return (
    <>
    {word && <figure className="hud-word-picture"><WordPicture word={word} /><figcaption>{journeyLabel}</figcaption></figure>}
    <div className="hud-controls-bar">
      {onRepeat && <button className="hud-ctrl-btn hud-repeat-btn" type="button" aria-label="Ouvir novamente" title="Ouvir novamente" onClick={onRepeat}><span aria-hidden="true">🔊</span></button> }
      {onHint && <button className="hud-ctrl-btn hud-hint-btn" type="button" aria-label="Pedir dica" title="Pedir dica" onClick={onHint}><span aria-hidden="true">💡</span></button>}
      {/* Hidden by CSS on very small screens; the pause menu offers it there. */}
      {supported && (
        <button
          className="hud-ctrl-btn hud-fullscreen-btn"
          type="button"
          aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          onClick={() => {
            void toggleFullscreen();
          }}
        >
          {fullscreen ? '🗗' : '⛶'}
        </button>
      )}
      <button
        className="hud-ctrl-btn pause-btn"
        type="button"
        aria-label="Pausar"
        title="Pausar"
        onClick={() => {
          onPause();
        }}
      >
        ⏸
      </button>
    </div>
    </>
  );
}

export interface PracticeCoachOptions {
  stepNumber: number;
  totalSteps: number;
  title: string;
  body: string;
  done: boolean;
  onSkip: () => void;
  onRepeat: () => void;
  onFinish: () => void;
}

/**
 * Coach for the controls practice (docs/18 §8): one short step at a time at
 * the top of the screen, so it never covers the buttons being taught. Can be
 * skipped at any step; the text is announced politely, never every frame.
 * Its actions are text buttons with their own geometry — never the 48 × 48
 * icon class of the HUD (docs/22 M01).
 */
function PracticeCoach({ stepNumber, totalSteps, title, body, done, onSkip, onRepeat, onFinish }: PracticeCoachOptions) {
  return (
    <div className="practice-coach">
      <div role="status" aria-live="polite">
        {!done && <p className="practice-coach-step">Passo {stepNumber} de {totalSteps}</p>}
        <p className="practice-coach-title">{title}</p>
        <p className="practice-coach-body">{body}</p>
      </div>
      <div className="practice-coach-actions">
        {done ? (
          <>
            <button className="practice-coach-btn" type="button" onClick={onRepeat}><span aria-hidden="true">↺ </span>Repetir</button>
            <button className="practice-coach-btn practice-coach-primary" type="button" onClick={onFinish}>Continuar</button>
          </>
        ) : (
          <button className="practice-coach-btn" type="button" onClick={onSkip}>Pular introdução</button>
        )}
      </div>
    </div>
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

  showPauseButton(options: PauseButtonOptions): void {
    this._current?.cleanup();
    const { node, cleanup } = mountScreen(<HudControlsBar {...options} />);
    clear(this._root);
    this._root.append(node);
    this._current = { node, cleanup };
  }

  /** Replaces the HUD bar with the practice coach (same root and lifetime rules). */
  showPracticeCoach(options: PracticeCoachOptions): void {
    this._current?.cleanup();
    const { node, cleanup } = mountScreen(<PracticeCoach {...options} />);
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
