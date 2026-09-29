/**
 * Screen wake lock with an explicit, observable state (docs/19 §4 P0.3).
 *
 * The Wake Lock API releases itself whenever the page is hidden, and the
 * system may release it at any time (battery saver). This keeper listens to
 * `release`, re-acquires when the page is visible and the session still needs
 * it — with a bounded number of consecutive failures, so a refusal never turns
 * into a loop — and never keeps a lock that arrives after `stop()`.
 *
 * "active" is shown to the adult only when a lock is actually held. It keeps
 * the screen from dimming; it does not stop anyone from locking the phone.
 */
export type WakeLockState = 'idle' | 'requesting' | 'active' | 'released' | 'unavailable' | 'error';

interface Sentinel {
  release(): Promise<void> | void;
  addEventListener?(type: 'release', listener: () => void): void;
  removeEventListener?(type: 'release', listener: () => void): void;
}

export interface WakeLockApi {
  request(type: 'screen'): Promise<Sentinel>;
}

interface KeeperOptions {
  wakeLock?: WakeLockApi | null;
  doc?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
  maxFailures?: number;
  onChange?: (state: WakeLockState) => void;
}

export const WAKE_LOCK_MAX_FAILURES = 3;

function defaultWakeLock(): WakeLockApi | null {
  const nav = (typeof navigator === 'undefined' ? undefined : navigator) as (Navigator & { wakeLock?: WakeLockApi }) | undefined;
  return nav?.wakeLock ?? null;
}

export class WakeLockKeeper {
  private _api: WakeLockApi | null;
  private _doc: KeeperOptions['doc'];
  private _maxFailures: number;
  private _onChange: (state: WakeLockState) => void;
  private _state: WakeLockState = 'idle';
  private _wanted = false;
  private _sentinel: Sentinel | null = null;
  private _pending: Promise<void> | null = null;
  private _failures = 0;
  private _disposed = false;
  private readonly _onVisibility = () => {
    if (this._doc?.visibilityState !== 'visible' || !this._wanted) return;
    // Coming back is a fresh chance even after refusals: the cause may have been the hidden page itself.
    this._failures = 0;
    void this._acquire();
  };
  private readonly _onRelease = () => {
    this._detachSentinel();
    if (!this._wanted) return;
    this._setState('released');
    if (this._doc?.visibilityState === 'visible') void this._acquire();
  };

  constructor({ wakeLock = defaultWakeLock(), doc = typeof document === 'undefined' ? undefined : document, maxFailures = WAKE_LOCK_MAX_FAILURES, onChange = () => {} }: KeeperOptions = {}) {
    this._api = wakeLock;
    this._doc = doc;
    this._maxFailures = maxFailures;
    this._onChange = onChange;
    this._doc?.addEventListener('visibilitychange', this._onVisibility);
    if (!this._api) this._state = 'unavailable';
  }

  get state(): WakeLockState {
    return this._state;
  }

  get active(): boolean {
    return this._state === 'active';
  }

  /** Idempotent: a second call while one request is pending or a lock is held does nothing. */
  start(): Promise<void> {
    if (this._disposed) return Promise.resolve();
    this._wanted = true;
    this._failures = 0;
    return this._acquire();
  }

  /** Releases the lock; a request still in flight is released as soon as it lands. */
  stop(): void {
    this._wanted = false;
    const sentinel = this._sentinel;
    this._detachSentinel();
    if (sentinel) void Promise.resolve(sentinel.release()).catch(() => {});
    if (this._api) this._setState('idle');
  }

  dispose(): void {
    this.stop();
    this._disposed = true;
    this._doc?.removeEventListener('visibilitychange', this._onVisibility);
  }

  private _acquire(): Promise<void> {
    if (!this._api) {
      this._setState('unavailable');
      return Promise.resolve();
    }
    if (this._sentinel || this._pending) return this._pending ?? Promise.resolve();
    if (this._failures >= this._maxFailures) return Promise.resolve();
    if (this._doc && this._doc.visibilityState !== 'visible') return Promise.resolve();

    this._setState('requesting');
    const api = this._api;
    this._pending = (async () => {
      try {
        const sentinel = await api.request('screen');
        if (!this._wanted || this._disposed) {
          await Promise.resolve(sentinel.release()).catch(() => {});
          return;
        }
        this._failures = 0;
        this._sentinel = sentinel;
        sentinel.addEventListener?.('release', this._onRelease);
        this._setState('active');
      } catch {
        this._failures += 1;
        if (this._wanted) this._setState('error');
      } finally {
        this._pending = null;
      }
    })();
    return this._pending;
  }

  private _detachSentinel(): void {
    this._sentinel?.removeEventListener?.('release', this._onRelease);
    this._sentinel = null;
  }

  private _setState(state: WakeLockState): void {
    if (this._state === state) return;
    this._state = state;
    this._onChange(state);
  }
}
