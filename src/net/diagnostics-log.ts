/**
 * Connection diagnostics that survive a reload (docs/19 §4 P0.1).
 *
 * A bounded ring of small events — page lifecycle, socket and join results,
 * wake lock, sensor health — persisted to localStorage periodically and on
 * every transition that may precede the page dying (hidden, pagehide, drops).
 * `unload` is never relied on. The run before this page load is kept as
 * `previous`, so after a reload the sequence that led to it can be read back.
 *
 * Privacy (docs/10): no pairing code, token, URL, name or raw sensor stream is
 * ever stored — detail keys that could carry them are dropped and strings are
 * truncated. The report is shown on screen and copied only on request.
 */

export type DiagnosticValue = string | number | boolean | null;
export type DiagnosticDetail = Record<string, DiagnosticValue>;

export interface DiagnosticEvent {
  seq: number;
  /** Wall clock, ms. */
  at: number;
  /** Monotonic ms since page start — immune to clock changes within one run. */
  mono: number;
  type: string;
  detail?: DiagnosticDetail;
}

export interface DiagnosticRun {
  runId: string;
  role: string;
  build: string;
  navigation: string;
  startedAt: number;
  events: DiagnosticEvent[];
  dropped: number;
}

interface StoredDiagnostics {
  current: DiagnosticRun | null;
  previous: DiagnosticRun | null;
}

export interface DiagnosticsLogOptions {
  role: 'viewer' | 'controller';
  build?: string;
  navigation?: string;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  maxEvents?: number;
  persistDelayMs?: number;
  now?: () => number;
  mono?: () => number;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (id: unknown) => void;
  randomId?: () => string;
  /** Keep everything in memory until `enablePersistence()` (the game: only once phone control is used). */
  deferPersistence?: boolean;
}

export const MAX_DIAGNOSTIC_EVENTS = 300;
const FORBIDDEN_KEY = /session|token|url|name|code/i;
const MAX_STRING = 80;

/** Events after which the page may be gone before the next periodic save. */
const FLUSH_NOW = new Set([
  'visibility-hidden',
  'pagehide',
  'freeze',
  'socket-disconnect',
  'join-error',
  'session-end',
  'wake-lock-released',
  'link-status',
  'sensor-status',
]);

function safeLocalStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function defaultRandomId(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') || Math.random().toString(16).slice(2, 14);
}

export function sanitizeDetail(detail: Record<string, unknown> | undefined): DiagnosticDetail | undefined {
  if (!detail) return undefined;
  const clean: DiagnosticDetail = {};
  for (const [key, value] of Object.entries(detail)) {
    if (FORBIDDEN_KEY.test(key)) continue;
    if (value === null || typeof value === 'boolean') clean[key] = value;
    else if (typeof value === 'number') clean[key] = Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
    else if (typeof value === 'string') clean[key] = value.slice(0, MAX_STRING);
  }
  return Object.keys(clean).length ? clean : undefined;
}

export class DiagnosticsLog {
  private _storage: DiagnosticsLogOptions['storage'];
  private _key: string;
  private _max: number;
  private _persistDelayMs: number;
  private _now: () => number;
  private _mono: () => number;
  private _setTimeout: (fn: () => void, ms: number) => unknown;
  private _clearTimeout: (id: unknown) => void;
  private _timer: unknown = null;
  private _seq = 0;
  private _persist: boolean;
  private _current: DiagnosticRun;
  private _previous: DiagnosticRun | null;

  constructor({
    role,
    build = 'dev',
    navigation = 'unknown',
    storage = safeLocalStorage(),
    maxEvents = MAX_DIAGNOSTIC_EVENTS,
    persistDelayMs = 5000,
    now = () => Date.now(),
    mono = () => (typeof performance !== 'undefined' ? performance.now() : 0),
    setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
    clearTimeoutFn = (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    randomId = defaultRandomId,
    deferPersistence = false,
  }: DiagnosticsLogOptions) {
    this._persist = !deferPersistence;
    this._storage = storage;
    this._key = `aventura.diagnostics.${role}`;
    this._max = maxEvents;
    this._persistDelayMs = persistDelayMs;
    this._now = now;
    this._mono = mono;
    this._setTimeout = setTimeoutFn;
    this._clearTimeout = clearTimeoutFn;

    const stored = this._load();
    // Only one earlier run is kept: the one that ended with this page load.
    this._previous = stored.current ?? stored.previous;
    this._current = { runId: randomId(), role, build, navigation, startedAt: now(), events: [], dropped: 0 };
    this.record('run-start', { navigation });
  }

  get runId(): string {
    return this._current.runId;
  }

  get current(): DiagnosticRun {
    return this._current;
  }

  get previous(): DiagnosticRun | null {
    return this._previous;
  }

  record(type: string, detail?: Record<string, unknown>): void {
    this._seq += 1;
    const event: DiagnosticEvent = { seq: this._seq, at: this._now(), mono: Math.round(this._mono()), type: type.slice(0, 40) };
    const clean = sanitizeDetail(detail);
    if (clean) event.detail = clean;
    this._current.events.push(event);
    if (this._current.events.length > this._max) {
      this._current.events.splice(0, this._current.events.length - this._max);
      this._current.dropped += 1;
    }
    if (FLUSH_NOW.has(type)) this.flush();
    else this._schedule();
  }

  /** Starts writing to storage (and writes what was kept in memory so far). Idempotent. */
  enablePersistence(): void {
    if (this._persist) return;
    this._persist = true;
    this.flush();
  }

  /** Writes now (also cancels a pending periodic save). */
  flush(): void {
    if (this._timer) this._clearTimeout(this._timer);
    this._timer = null;
    if (!this._storage || !this._persist) return;
    try {
      const data: StoredDiagnostics = { current: this._current, previous: this._previous };
      this._storage.setItem(this._key, JSON.stringify(data));
    } catch {
      // quota or blocked storage: the in-memory copy still feeds the report
    }
  }

  /** "Apagar diagnóstico": forgets both runs, here and in storage. */
  clear(): void {
    this._previous = null;
    this._current.events = [];
    this._current.dropped = 0;
    try {
      this._storage?.removeItem(this._key);
    } catch {
      // nothing stored
    }
  }

  /** Plain text for the support screens: one event per line, times relative to each run's start. */
  formatReport(title = 'Diagnóstico da conexão'): string {
    const lines = [title];
    const describe = (label: string, run: DiagnosticRun | null) => {
      if (!run) {
        lines.push(`${label}: nenhuma`);
        return;
      }
      lines.push(
        `${label}: execução ${run.runId} · ${run.role} · versão ${run.build} · navegação ${run.navigation} · início ${new Date(run.startedAt).toISOString()}${run.dropped ? ` · ${run.dropped} eventos antigos descartados` : ''}`,
      );
      const first = run.events[0]?.mono ?? 0;
      for (const event of run.events) {
        const detail = event.detail
          ? ' ' + Object.entries(event.detail).map(([k, v]) => `${k}=${v}`).join(' ')
          : '';
        lines.push(`  +${((event.mono - first) / 1000).toFixed(1)}s #${event.seq} ${event.type}${detail}`);
      }
    };
    describe('Execução atual', this._current);
    describe('Execução anterior', this._previous);
    return lines.join('\n');
  }

  private _schedule(): void {
    if (this._timer || !this._storage || !this._persist) return;
    this._timer = this._setTimeout(() => {
      this._timer = null;
      this.flush();
    }, this._persistDelayMs);
  }

  private _load(): StoredDiagnostics {
    try {
      const raw = this._storage?.getItem(this._key);
      if (!raw) return { current: null, previous: null };
      const parsed = JSON.parse(raw) as StoredDiagnostics;
      const valid = (run: unknown): run is DiagnosticRun =>
        !!run && typeof run === 'object' && Array.isArray((run as DiagnosticRun).events);
      return { current: valid(parsed?.current) ? parsed.current : null, previous: valid(parsed?.previous) ? parsed.previous : null };
    } catch {
      return { current: null, previous: null };
    }
  }
}

/** The page's navigation type (`navigate`, `reload`, `back_forward`...), when the browser reports it. */
export function readNavigationType(): string {
  try {
    const entry = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
    return entry?.type ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Records the page lifecycle transitions that tell "the tab was hidden or
 * frozen" apart from "the network dropped". `navigator.onLine` is logged as
 * reported, never taken as proof the server is reachable.
 * @returns unsubscribe
 */
export function recordPageLifecycle(log: DiagnosticsLog, win: Window = window, doc: Document = document): () => void {
  const handlers: Array<[EventTarget, string, EventListener]> = [
    [doc, 'visibilitychange', () => log.record(doc.visibilityState === 'hidden' ? 'visibility-hidden' : 'visibility-visible')],
    [win, 'pagehide', (event) => log.record('pagehide', { persisted: Boolean((event as PageTransitionEvent).persisted) })],
    [win, 'pageshow', (event) => log.record('pageshow', { persisted: Boolean((event as PageTransitionEvent).persisted) })],
    [doc, 'freeze', () => log.record('freeze')],
    [doc, 'resume', () => log.record('resume')],
    [win, 'online', () => log.record('online')],
    [win, 'offline', () => log.record('offline')],
  ];
  for (const [target, type, handler] of handlers) target.addEventListener(type, handler);
  return () => {
    for (const [target, type, handler] of handlers) target.removeEventListener(type, handler);
  };
}

/** Build label shared by both pages (falls back to `dev` outside a Vite build). */
export function buildLabel(): string {
  try {
    return `${__APP_VERSION__}+${__APP_COMMIT__}`;
  } catch {
    return 'dev';
  }
}
