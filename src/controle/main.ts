import { el, clear } from '../ui/dom.js';
import { parseControleParams } from './controle-params.js';
import { JumpDetector, magnitudeInG, type JumpDetectorThresholds } from './jump-detector.js';
import { loadThresholds, saveThresholds } from './threshold-storage.js';
import { PhoneControllerTransport } from '../net/phone-controller-transport.js';
import { statusMessage, canRetry, type AppState } from './status-message.js';

const CALIBRATION_MS = 1500;
const VIBRATION_MS = 50;
const VIBRATION_MIN_GAP_MS = 100;

type DeviceMotionEventWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/** iOS 13+ requires an explicit user-gesture permission grant; Android does not have this API at all. */
async function requestMotionPermission(): Promise<boolean> {
  const ctor = (globalThis as { DeviceMotionEvent?: DeviceMotionEventWithPermission }).DeviceMotionEvent;
  if (typeof ctor?.requestPermission !== 'function') return true; // Android, or a browser without the gate
  try {
    return (await ctor.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** Best-effort: acquires the screen wake lock. Silently a no-op where unsupported. */
async function requestWakeLock(): Promise<{ release: () => void } | null> {
  const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release: () => void }> } };
  if (!nav.wakeLock) return null;
  try {
    return await nav.wakeLock.request('screen');
  } catch {
    return null;
  }
}

/**
 * The Wake Lock API releases itself the instant the tab goes to the
 * background (app switch, incoming call, phone flipped over) — it does not
 * re-acquire on its own. Without listening for `visibilitychange`, a single
 * distraction on the child's phone silently turned this protection off for
 * the rest of the match, with no visible sign anything had changed.
 */
class WakeLockKeeper {
  private _lock: { release: () => void } | null = null;
  private _active = false;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (this._active && document.visibilityState === 'visible') void this._acquire();
    });
  }

  async start(): Promise<void> {
    this._active = true;
    await this._acquire();
  }

  private async _acquire(): Promise<void> {
    this._lock = await requestWakeLock();
  }
}

function vibrate(ms: number): void {
  navigator.vibrate?.(ms);
}

/**
 * A stale service worker silently serving the wrong cached page (see
 * navigateFallbackDenylist fix) and a missing/garbled `session` look
 * identical from the outside — a blank or wrong screen with nothing to go
 * on. This line stays visible through every phase (not gated behind
 * `?debug=1`, since the bug it's meant to catch happens before calibration
 * ever runs) so a photo of the phone screen is enough to tell them apart.
 */
function techStatusLine(session: string | null): string {
  const swState = navigator.serviceWorker?.controller ? 'sw ativo' : 'sem sw';
  return `session=${session ?? '(nenhuma)'} · ${swState}`;
}

function render(root: HTMLElement, state: AppState, onStart: () => void, session: string | null): void {
  clear(root);
  const items: (Node | string)[] = [
    el('h1', { class: 'controle-title', text: 'Controle por celular' }),
    el('p', { class: 'controle-status', text: statusMessage(state) }),
    el('p', { class: 'controle-tech-status', text: techStatusLine(session) }),
  ];
  if (canRetry(state)) {
    items.push(
      el('button', {
        class: 'controle-start-btn',
        type: 'button',
        text: 'Toque para começar',
        onClick: onStart,
      }),
    );
  }
  root.append(...items);
}

/**
 * Lets a threshold be tuned live against a real child (§10) without a
 * rebuild. Mutates `thresholds` in place — the same object instance the
 * `JumpDetector` was constructed with reads its fields fresh on every
 * `feed()` call, so no extra wiring is needed to push the change through.
 */
function renderDebugPanel(root: HTMLElement, thresholds: JumpDetectorThresholds): void {
  const panel = el('div', { class: 'controle-debug-panel' });
  const fields: Array<[keyof JumpDetectorThresholds, string, number, number, number]> = [
    ['freefallDeltaG', 'Queda livre (g)', 0.05, 1, 0.05],
    ['impactDeltaG', 'Impacto (g)', 0.1, 2, 0.05],
    ['minFreefallMs', 'Queda mín. (ms)', 0, 400, 10],
    ['maxFreefallMs', 'Queda máx. (ms)', 200, 1500, 10],
    ['cooldownMs', 'Cooldown (ms)', 100, 1500, 10],
  ];

  for (const [key, label, min, max, step] of fields) {
    const valueLabel = el('span', { class: 'controle-debug-value', text: String(thresholds[key]) });
    const input = el('input', {
      type: 'range',
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(thresholds[key]),
      onInput: (event: Event) => {
        const target = event.target as HTMLInputElement;
        // minFreefallMs >= maxFreefallMs makes a jump impossible to confirm:
        // the freefall state resets to idle once maxFreefallMs elapses, so a
        // longer minFreefallMs would never get the chance to be reached.
        // Clamp instead of letting the panel silently produce a dead config.
        let value = Number(target.value);
        if (key === 'minFreefallMs') value = Math.min(value, thresholds.maxFreefallMs - 10);
        if (key === 'maxFreefallMs') value = Math.max(value, thresholds.minFreefallMs + 10);
        thresholds[key] = value;
        target.value = String(value);
        valueLabel.textContent = String(value);
        saveThresholds(thresholds);
      },
    });
    panel.append(el('label', { class: 'controle-debug-row' }, [label, input, valueLabel]));
  }
  root.append(panel);
}

/**
 * Without this, any exception thrown before the first `render()` call left
 * the page a blank dark rectangle (body's background-color, nothing else) —
 * indistinguishable from the page just being slow, with no way to tell what
 * broke from the phone itself. Renders whatever detail is available directly
 * into the page instead.
 */
function renderFatalError(root: HTMLElement, error: unknown): void {
  clear(root);
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  root.append(
    el('h1', { class: 'controle-title', text: 'Algo deu errado' }),
    el('p', { class: 'controle-status', text: 'Recarregue a página. Se persistir, mostre esta mensagem:' }),
    el('p', { class: 'controle-status', text: message }),
  );
}

async function main(): Promise<void> {
  const rootEl = document.getElementById('controle-root');
  if (!rootEl) return;
  const root: HTMLElement = rootEl;

  window.addEventListener('error', (event) => {
    console.error('[controle] uncaught error', event.error ?? event.message);
    renderFatalError(root, event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[controle] unhandled rejection', event.reason);
    renderFatalError(root, event.reason);
  });

  const { session, debug } = parseControleParams(window.location.search);
  const state: AppState = { phase: 'idle', connected: false, roomError: null };

  const thresholds: JumpDetectorThresholds = loadThresholds();

  const rerender = (): void => {
    render(root, state, start, session);
    if (debug && (state.phase === 'calibrating' || state.phase === 'listening')) {
      renderDebugPanel(root, thresholds);
    }
  };

  if (!session) {
    state.phase = 'invalid-link';
    rerender();
    return;
  }

  const detector = new JumpDetector(thresholds);
  const transport = new PhoneControllerTransport(session);
  const wakeLock = new WakeLockKeeper();
  let lastJumpVibration = 0;

  transport.onConnectionChange((connected) => {
    state.connected = connected;
    rerender();
  });

  transport.onJoinError(({ error }) => {
    state.roomError =
      error === 'room-full'
        ? 'Outro celular já está pareado com esse jogo.'
        : 'Não foi possível parear. Gere um novo QR code na tela do jogo.';
    rerender();
  });

  transport.onRoomClosed(() => {
    state.roomError = 'A partida terminou. Gere um novo QR code para jogar de novo.';
    rerender();
  });

  // Every other call to rerender() above is a reaction to some later event
  // (a socket state change, a join error) — none of them fire on their own.
  // Without this, the initial "idle" screen (title + "Toque para começar"
  // button) never paints: the page stays blank forever, since nothing ever
  // triggers the button that would start the flow that would trigger a
  // render.
  rerender();

  async function start(): Promise<void> {
    state.roomError = null;
    state.phase = 'requesting-permission';
    rerender();

    const granted = await requestMotionPermission();
    if (!granted) {
      state.phase = 'permission-denied';
      rerender();
      return;
    }

    await wakeLock.start();
    transport.connect();

    state.phase = 'calibrating';
    rerender();

    const calibrationSamples: { x: number; y: number; z: number }[] = [];
    const onCalibrate = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (a && a.x != null && a.y != null && a.z != null) {
        calibrationSamples.push({ x: a.x, y: a.y, z: a.z });
      }
    };
    window.addEventListener('devicemotion', onCalibrate);

    await new Promise((resolve) => setTimeout(resolve, CALIBRATION_MS));
    window.removeEventListener('devicemotion', onCalibrate);
    detector.calibrate(calibrationSamples);

    console.log(
      `[controle] calibração samples=${calibrationSamples.length} restMagnitude=${detector.restMagnitude.toFixed(3)}g freefallThreshold=${detector.freefallThreshold.toFixed(3)}g impactThreshold=${detector.impactThreshold.toFixed(3)}g`,
    );

    state.phase = 'listening';
    rerender();

    let lastBackgroundLog = 0;
    const BACKGROUND_LOG_INTERVAL_MS = 500;

    window.addEventListener('devicemotion', (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;

      const sample = { x: a.x, y: a.y, z: a.z };
      const magnitude = magnitudeInG(sample);
      const stateBefore = detector.state;
      const now = performance.now();
      const jumped = detector.feed(sample, now);
      const stateAfter = detector.state;

      if (stateBefore === 'idle' && stateAfter === 'freefall') {
        console.log(`[controle] freefall início magnitude=${magnitude.toFixed(3)}g freefallThreshold=${detector.freefallThreshold.toFixed(3)}g`);
      } else if (jumped) {
        console.log(`[controle] pulo confirmado magnitude=${magnitude.toFixed(3)}g impactThreshold=${detector.impactThreshold.toFixed(3)}g`);
      } else if (stateBefore === 'freefall' && stateAfter === 'idle') {
        console.log(`[controle] freefall abortado (excedeu maxFreefallMs) magnitude=${magnitude.toFixed(3)}g`);
      } else if (now - lastBackgroundLog > BACKGROUND_LOG_INTERVAL_MS) {
        console.log(`[controle] leitura magnitude=${magnitude.toFixed(3)}g estado=${stateAfter}`);
        lastBackgroundLog = now;
      }

      if (!jumped) return;

      transport.sendJump();
      if (now - lastJumpVibration > VIBRATION_MIN_GAP_MS) {
        vibrate(VIBRATION_MS);
        lastJumpVibration = now;
      }
    });
  }
}

main();
