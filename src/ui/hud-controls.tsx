import { WordPicture } from './screens/word-picture.js';
import type { WordEntry } from '../content/word-bank.js';
import { mountScreen } from './screens/mount-screen.js';
import { clear } from './dom.js';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { isFullscreenSupported, isFullscreen, toggleFullscreen, onFullscreenChange } from './fullscreen.js';
import { hudSnapshotKey, type HudSnapshot } from './hud-info.js';

/** Latest HUD snapshot, pushed by the game scene; listeners fire only on real changes. */
class HudInfoStore {
  private _snapshot: HudSnapshot | null = null;
  private _key = '';
  private _listeners = new Set<() => void>();

  get = (): HudSnapshot | null => this._snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  };

  set(snapshot: HudSnapshot | null): void {
    const key = snapshot ? hudSnapshotKey(snapshot) : '';
    if (key === this._key) return;
    this._key = key;
    this._snapshot = snapshot;
    for (const listener of [...this._listeners]) listener();
  }
}

const FEEDBACK_SIGNS = { correct: '✔', wrong: '✖', hint: '💡' } as const;

/**
 * The informative HUD in DOM (docs/17 §4, entrega 5): level, progress badge,
 * objective, letter board, hearts and the answer banner, laid out on the same
 * grid as the action buttons, so they can never overlap and every size is in
 * rem (follows "Texto ampliado" and browser zoom). Not a live region: the
 * objective and feedback are announced once by LiveAnnouncer, the clock never.
 */
function HudStatus({ info }: { info: HudSnapshot }) {
  return (
    <>
      {info.levelName && <p className="hud-level">Fase: {info.levelName}</p>}
      {info.badge && <p className="hud-badge">{info.badge}</p>}
    </>
  );
}

function HudGoal({ info }: { info: HudSnapshot }) {
  const found = info.board.filter((slot) => slot.revealed).length;
  return (
    <>
      {info.objective && <p className="hud-objective">{info.objective}</p>}
      {info.board.length > 0 && (
        <p className="hud-board" role="img" aria-label={`Palavra: ${found} de ${info.board.length} letras encontradas`}>
          {info.board.map((slot, i) => (
            <span key={i} className={`hud-slot${slot.revealed ? ' is-revealed' : ''}${slot.isNext ? ' is-next' : ''}`} aria-hidden="true">
              {slot.revealed ? slot.char : '_'}
            </span>
          ))}
        </p>
      )}
    </>
  );
}

function HudHearts({ info }: { info: HudSnapshot }) {
  const hearts = Array.from({ length: info.maxLives }, (_, i) => i < info.lives);
  return (
    <p className="hud-hearts" role="img" aria-label={`Vidas: ${info.lives} de ${info.maxLives}`}>
      {hearts.map((full, i) => <span key={i} className={`hud-heart${full ? ' is-full' : ''}`} aria-hidden="true">♥</span>)}
    </p>
  );
}

function HudFeedback({ info }: { info: HudSnapshot }) {
  if (!info.feedback) return null;
  // Not colour alone: the banner starts with a sign that says right, wrong or hint.
  return (
    <p className={`hud-feedback is-${info.feedback.kind}`} aria-hidden="true">
      <span className="hud-feedback-sign">{FEEDBACK_SIGNS[info.feedback.kind]}</span> {info.feedback.message}
    </p>
  );
}

interface PauseButtonOptions {
  onPause: () => void;
  onRepeat?: () => void;
  /** Progressive hint; distinct from repeating the audio (docs/20 §4 L2). */
  onHint?: () => void;
  word?: WordEntry;
  journeyLabel?: string;
}

function HudControlsBar({ onPause, onRepeat, onHint, word, journeyLabel, store }: PauseButtonOptions & { store: HudInfoStore }) {
  const [fullscreen, setFullscreen] = useState(() => isFullscreen());
  const info = useSyncExternalStore(store.subscribe, store.get, store.get);
  const supported = isFullscreenSupported();

  useEffect(() => {
    return onFullscreenChange((active) => setFullscreen(active));
  }, []);

  return (
    <div className={`hud-layer${info ? ' has-info' : ''}`}>
    <div className="hud-top">
    <div className="hud-status">
      {info && <HudStatus info={info} />}
      {word && <figure className="hud-word-picture"><WordPicture word={word} /><figcaption>{journeyLabel}</figcaption></figure>}
    </div>
    <div className="hud-goal">{info && <HudGoal info={info} />}{info && <HudFeedback info={info} />}</div>
    <div className="hud-side">
    {info && <HudHearts info={info} />}
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
    </div>
    </div>
    </div>
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
  private _info = new HudInfoStore();

  constructor({ root }: HudControlsOptions) {
    this._root = root;
  }

  /** The match's HUD information; cheap to call every frame (re-renders only on change). */
  updateInfo(snapshot: HudSnapshot | null): void {
    this._info.set(snapshot);
  }

  showPauseButton(options: PauseButtonOptions): void {
    this._current?.cleanup();
    const { node, cleanup } = mountScreen(<HudControlsBar {...options} store={this._info} />);
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
    this._info.set(null);
    clear(this._root);
  }
}
