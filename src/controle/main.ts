import { el, clear } from '../ui/dom.js';
import { parseControleParams } from './controle-params.js';
import { JumpDetector, DEFAULT_JUMP_DETECTOR_THRESHOLDS, type JumpDetectorThresholds } from './jump-detector.js';
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

/** Best-effort: keeps the screen (and the devicemotion listener) alive. Silently a no-op where unsupported. */
async function requestWakeLock(): Promise<{ release: () => void } | null> {
  const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release: () => void }> } };
  if (!nav.wakeLock) return null;
  try {
    return await nav.wakeLock.request('screen');
  } catch {
    return null;
  }
}

function vibrate(ms: number): void {
  navigator.vibrate?.(ms);
}

function render(root: HTMLElement, state: AppState, onStart: () => void): void {
  clear(root);
  const items: (Node | string)[] = [
    el('h1', { class: 'controle-title', text: 'Controle por celular' }),
    el('p', { class: 'controle-status', text: statusMessage(state) }),
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
        const value = Number((event.target as HTMLInputElement).value);
        thresholds[key] = value;
        valueLabel.textContent = String(value);
      },
    });
    panel.append(el('label', { class: 'controle-debug-row' }, [label, input, valueLabel]));
  }
  root.append(panel);
}

async function main(): Promise<void> {
  const rootEl = document.getElementById('controle-root');
  if (!rootEl) return;
  const root: HTMLElement = rootEl;

  const { session, debug } = parseControleParams(window.location.search);
  const state: AppState = { phase: 'idle', connected: false, roomError: null };

  const thresholds: JumpDetectorThresholds = { ...DEFAULT_JUMP_DETECTOR_THRESHOLDS };

  const rerender = (): void => {
    render(root, state, start);
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

    await requestWakeLock();
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

    state.phase = 'listening';
    rerender();

    window.addEventListener('devicemotion', (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const jumped = detector.feed({ x: a.x, y: a.y, z: a.z }, performance.now());
      if (!jumped) return;

      transport.sendJump();
      const now = performance.now();
      if (now - lastJumpVibration > VIBRATION_MIN_GAP_MS) {
        vibrate(VIBRATION_MS);
        lastJumpVibration = now;
      }
    });
  }
}

main();
