import { el, clear } from '../ui/dom.js';
import { renderControllerView, type PocketMode } from './view.js';
import { renderDebugPanel, downloadTextFile } from './debug-panel.js';
import { parseControleParams } from './controle-params.js';
import {
  JumpDetector,
  magnitudeInG,
  DEFAULT_JUMP_DETECTOR_THRESHOLDS,
  type JumpDetectorThresholds,
} from './jump-detector.js';
import { loadThresholds, saveThresholds } from './threshold-storage.js';
import { SessionRecorder } from './session-recorder.js';
import { resolveEventTime } from './sensor-time.js';
import { PhoneControllerTransport } from '../net/phone-controller-transport.js';
import { roomErrorFor, type AppState } from './status-message.js';
import { MotionSession, type MotionReading } from './motion-session.js';
import { WakeLockKeeper } from './wake-lock-keeper.js';
import { DiagnosticsLog, buildLabel, readNavigationType, recordPageLifecycle } from '../net/diagnostics-log.js';

const CALIBRATION_MS = 1500;
const VIBRATION_MS = 50;
const VIBRATION_MIN_GAP_MS = 100;
/** Liveness beacon to the game (docs/19 §4 P0.2); the game pauses after ~3 s without one. */
const HEALTH_INTERVAL_MS = 1000;
/** How often the status line re-checks sensor freshness. */
const UI_TICK_MS = 500;
/** The pocket-mode exit confirmation falls back to protected after this long (docs/19 §4 P1.1). */
const POCKET_CONFIRM_TIMEOUT_MS = 6000;
/**
 * Re-estimates the resting magnitude in quiet stretches, so a phone sliding on
 * the body doesn't skew thresholds. Off until `npm run replay:session --
 * <file> --trackRest` shows a gain on a real recording.
 */
const TRACK_REST = false;

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
 * Only a prefix of the code is shown: the photo may be shared.
 */
function techStatusLine(session: string | null, runId: string): string {
  const swState = navigator.serviceWorker?.controller ? 'sw ativo' : 'sem sw';
  const code = session ? `${session.slice(0, 2)}…(${session.length})` : '(nenhuma)';
  return `session=${code} · ${swState} · execução ${runId}`;
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

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
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

  const diagnostics = new DiagnosticsLog({ role: 'controller', build: buildLabel(), navigation: readNavigationType() });
  recordPageLifecycle(diagnostics);
  const diag = (type: string, detail?: Record<string, string | number | boolean | null>) => diagnostics.record(type, detail);

  const { session, debug } = parseControleParams(window.location.search);
  const state: AppState = { phase: 'idle', connected: false, roomError: null, joinState: 'idle', viewerPresent: false, sensor: 'none' };
  let pocket: PocketMode = 'off';
  let pocketConfirmTimer: ReturnType<typeof setTimeout> | null = null;
  let screen: 'main' | 'diagnostics' = 'main';
  let diagnosticsNote = '';
  let diagnosticsFallback: string | null = null;

  const thresholds: JumpDetectorThresholds = loadThresholds();
  const recorder = new SessionRecorder();
  let calibrationEndT: number | null = null;
  let reportedIntervalMs: number | null = null;
  let lastRenderKey = '';

  const detector = new JumpDetector(thresholds, { trackRest: TRACK_REST });

  const rerender = (force = false): void => {
    const key = JSON.stringify([state, pocket, screen, diagnosticsNote, diagnosticsFallback, debug]);
    if (!force && key === lastRenderKey) return;
    lastRenderKey = key;
    renderControllerView(
      root,
      { state, pocket, screen, techLine: techStatusLine(session, diagnostics.runId), diagnosticsNote, diagnosticsFallback },
      {
        onStart: () => void start(),
        onEnterPocket: () => enterPocket(),
        onPocketUnlockRequest: () => setPocket('confirm'),
        onPocketStay: () => setPocket('on'),
        onPocketExit: () => exitPocket(),
        onOpenDiagnostics: () => {
          screen = 'diagnostics';
          rerender(true);
        },
        onCloseDiagnostics: () => {
          screen = 'main';
          diagnosticsNote = '';
          diagnosticsFallback = null;
          rerender(true);
        },
        onCopyDiagnostics: async () => {
          const report = diagnostics.formatReport('Diagnóstico do controle');
          const copied = await copyText(report);
          diagnosticsNote = copied ? 'Relatório copiado.' : 'Não foi possível copiar: o relatório aparece abaixo.';
          diagnosticsFallback = copied ? null : report;
          rerender(true);
        },
        onClearDiagnostics: () => {
          diagnostics.clear();
          diagnosticsNote = 'Diagnóstico apagado.';
          diagnosticsFallback = null;
          rerender(true);
        },
      },
    );
    if (pocket === 'off' && screen === 'main' && debug && (state.phase === 'calibrating' || state.phase === 'listening')) {
      renderDebugPanel(root, thresholds, {
        onDownload: () => {
          const json = recorder.toJSON({
            thresholds,
            restMagnitude: detector.restMagnitude,
            calibrationEndT,
            trackRest: TRACK_REST,
            userAgent: navigator.userAgent,
            reportedIntervalMs,
          });
          downloadTextFile(`joguinho-sensor-${Date.now()}.json`, json, 'application/json');
        },
        onMarkJump: () => {
          recorder.mark('jump', performance.now());
          return recorder.markerCount;
        },
        getMarkCount: () => recorder.markerCount,
        onReset: () => {
          // In place, same object the detector reads (see renderDebugPanel's doc).
          Object.assign(thresholds, DEFAULT_JUMP_DETECTOR_THRESHOLDS);
          saveThresholds(thresholds);
          rerender(true);
        },
      });
    }
  };

  function setPocket(next: PocketMode): void {
    if (pocketConfirmTimer) clearTimeout(pocketConfirmTimer);
    pocketConfirmTimer = null;
    pocket = next;
    if (next === 'confirm') pocketConfirmTimer = setTimeout(() => setPocket('on'), POCKET_CONFIRM_TIMEOUT_MS);
    diag('pocket-mode', { mode: next });
    rerender(true);
  }

  function enterPocket(): void {
    setPocket('on');
    // Optional, after the tap that is the required gesture; the page works the same without it.
    void document.documentElement.requestFullscreen?.().catch(() => {});
  }

  function exitPocket(): void {
    setPocket('off');
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
  }

  if (!session) {
    state.phase = 'invalid-link';
    rerender();
    return;
  }

  let transport = createTransport(session);
  const wakeLock = new WakeLockKeeper({
    onChange: (wakeState) => {
      state.wakeLock = wakeState;
      diag(wakeState === 'released' ? 'wake-lock-released' : 'wake-lock', { state: wakeState });
      rerender();
    },
  });
  state.wakeLock = wakeLock.state;

  let lastJumpVibration = 0;
  let lastSampleT = -Infinity;
  let lastBackgroundLog = 0;
  let lastRestUpdates = detector.restUpdates;
  const BACKGROUND_LOG_INTERVAL_MS = 500;

  const onReading = (reading: MotionReading) => {
    const { sample, handlerNow } = reading;
    const magnitude = magnitudeInG(sample);
    const stateBefore = detector.state;
    // Measured time, kept monotonic — a batched delivery can hand samples over out of order.
    const now = Math.max(lastSampleT, resolveEventTime(reading.eventTimeStamp, handlerNow));
    lastSampleT = now;
    const jumped = detector.feed(sample, now);
    const stateAfter = detector.state;

    if (debug) {
      if (jumped && detector.lastJump) recorder.logDetection(now, detector.lastJump);
      if (detector.restUpdates !== lastRestUpdates) {
        lastRestUpdates = detector.restUpdates;
        console.log(`[controle] repouso reestimado restMagnitude=${detector.restMagnitude.toFixed(3)}g`);
      }
      if (stateBefore === 'idle' && stateAfter === 'freefall') {
        console.log(`[controle] freefall início magnitude=${magnitude.toFixed(3)}g freefallThreshold=${detector.freefallThreshold.toFixed(3)}g`);
      } else if (jumped) {
        console.log(`[controle] pulo confirmado (${detector.lastJump?.trigger}) magnitude=${magnitude.toFixed(3)}g takeoffG=${detector.lastJump?.takeoffG?.toFixed(3) ?? '-'} impactThreshold=${detector.impactThreshold.toFixed(3)}g`);
      } else if (stateBefore === 'freefall' && stateAfter === 'idle') {
        console.log(`[controle] freefall abortado (excedeu maxFreefallMs) magnitude=${magnitude.toFixed(3)}g`);
      } else if (now - lastBackgroundLog > BACKGROUND_LOG_INTERVAL_MS) {
        console.log(`[controle] leitura magnitude=${magnitude.toFixed(3)}g estado=${stateAfter}`);
        lastBackgroundLog = now;
      }
    }

    if (!jumped) return;
    // Only when everything that makes a jump meaningful holds; never queued for later.
    if (document.visibilityState !== 'visible' || !transport.viewerPresent || motion.health() !== 'ok') return;
    if (!transport.sendJump()) return;
    if (now - lastJumpVibration > VIBRATION_MIN_GAP_MS) {
      vibrate(VIBRATION_MS);
      lastJumpVibration = now;
    }
  };

  const motion = new MotionSession({
    onSample: onReading,
    onAnySample: (reading) => {
      if (!debug) return;
      const t = resolveEventTime(reading.eventTimeStamp, reading.handlerNow);
      recorder.push(reading.sample, t, reading.rotationRate, reading.handlerNow - t);
      reportedIntervalMs = reading.interval;
    },
    // A suspended page or throttled sensor: old and new samples must not form one "jump".
    onGap: (gapMs) => {
      detector.reset();
      lastSampleT = -Infinity;
      diag('sensor-gap', { ms: gapMs });
    },
  });

  function createTransport(code: string): PhoneControllerTransport {
    const next = new PhoneControllerTransport(code, { onDiagnostic: diag });
    next.onChange(() => syncTransportState());
    return next;
  }

  function syncTransportState(): void {
    state.connected = transport.connected;
    state.joinState = transport.state;
    state.viewerPresent = transport.viewerPresent;
    state.roomError = roomErrorFor(transport.state, transport.closeReason ?? transport.lastError);
    rerender();
  }

  const sendHealth = () => {
    if (state.phase !== 'listening') return;
    transport.sendHealth({ sensor: motion.health(), visible: document.visibilityState === 'visible' });
  };

  let lastSensor = state.sensor;
  setInterval(() => {
    if (state.phase !== 'listening') return;
    state.sensor = motion.health();
    if (state.sensor !== lastSensor) {
      diag('sensor-status', { health: state.sensor, rateHz: motion.rateHz });
      lastSensor = state.sensor;
    }
    rerender();
  }, UI_TICK_MS);
  setInterval(sendHealth, HEALTH_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    // Tell the game at once rather than letting it wait for missing beacons.
    sendHealth();
    if (document.visibilityState === 'visible') {
      detector.reset();
      lastSampleT = -Infinity;
    }
  });
  window.addEventListener('pagehide', () => {
    if (state.phase === 'listening') transport.sendHealth({ sensor: motion.health(), visible: false });
    diagnostics.flush();
  });

  // Every other call to rerender() above is a reaction to some later event
  // (a socket state change, a join error) — none of them fire on their own.
  // Without this, the initial "idle" screen (title + "Toque para começar"
  // button) never paints: the page stays blank forever, since nothing ever
  // triggers the button that would start the flow that would trigger a
  // render.
  rerender();

  let starting = false;

  /**
   * Idempotent flow behind "Toque para começar": permission, one sensor
   * subscription, screen protection, join (or rejoin), calibration. A retry
   * after an error reuses what already works instead of stacking listeners.
   */
  async function start(): Promise<void> {
    if (starting) return;
    starting = true;
    try {
      diag('start-tapped', { phase: state.phase });
      state.phase = 'requesting-permission';
      rerender();

      const granted = await requestMotionPermission();
      if (!granted) {
        state.phase = 'permission-denied';
        diag('sensor-permission', { granted: false });
        rerender();
        return;
      }

      motion.start();
      void wakeLock.start();

      // A finished session cannot be reused: only then is a new socket made.
      if (state.roomError) {
        transport.dispose();
        transport = createTransport(session!);
      }
      transport.connect();
      syncTransportState();

      state.phase = 'calibrating';
      rerender();

      const result = await motion.calibrate(CALIBRATION_MS);
      diag('calibration', { ok: result.ok, samples: result.samples.length, problem: result.problem });
      if (!result.ok) {
        state.phase = 'sensor-failed';
        state.sensor = motion.health();
        rerender();
        return;
      }
      detector.reset();
      detector.calibrate(result.samples);
      lastSampleT = -Infinity;
      calibrationEndT = performance.now();

      if (debug) {
        console.log(
          `[controle] calibração samples=${result.samples.length} restMagnitude=${detector.restMagnitude.toFixed(3)}g freefallThreshold=${detector.freefallThreshold.toFixed(3)}g impactThreshold=${detector.impactThreshold.toFixed(3)}g`,
        );
      }

      state.phase = 'listening';
      state.sensor = motion.health();
      rerender();
      sendHealth();
    } finally {
      starting = false;
    }
  }
}

main();
