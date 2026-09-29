import { Events, type EventBus } from '../core/event-bus.js';
import type { InputManager } from '../input/input-manager.js';
import { CompositeAdapter } from '../input/composite-adapter.js';
import { AutoRunAdapter } from '../input/auto-run-adapter.js';
import { PhoneAdapter } from '../input/phone-adapter.js';
import { startPhoneControlSession, type PhoneControlHandle } from './phone-control-session.js';
import type { ViewerLink } from './phone-viewer-transport.js';
import type { DiagnosticSink } from './signaling-socket.js';

/**
 * Why the phone can or cannot drive the game right now. Only `ok` is
 * operational; everything else pauses a match and blocks "Continuar".
 */
export type PhoneLinkReason =
  | 'off'
  | 'waiting-phone'
  | 'checking'
  | 'ok'
  | 'reconnecting'
  | 'phone-reconnecting'
  | 'phone-hidden'
  | 'sensor'
  | 'no-response'
  | 'ended';

export interface PhoneLinkStatus {
  /** A pairing session exists (QR shown or phone paired) until stop(). */
  session: boolean;
  /** A phone joined this session at least once and it has not ended. */
  paired: boolean;
  operational: boolean;
  reason: PhoneLinkReason;
  message: string;
}

const ENDED_MESSAGES: Record<string, string> = {
  expired: 'A sessão do celular expirou. Gere um novo QR code ou jogue com teclado/toque.',
  ended: 'A sessão do celular foi encerrada. Gere um novo QR code ou jogue com teclado/toque.',
  left: 'O celular foi desconectado. Gere um novo QR code ou jogue com teclado/toque.',
  replaced: 'Este jogo foi aberto em outra aba ou aparelho. Gere um novo QR code aqui para continuar.',
  'version-mismatch': 'O jogo e o servidor estão em versões diferentes. Atualize a página e gere um novo QR code.',
  'room-full': 'Esta sessão já está em uso em outra tela. Gere um novo QR code.',
};
const ENDED_DEFAULT = 'Não foi possível manter o celular conectado. Gere um novo QR code ou jogue com teclado/toque.';

export const PHONE_LINK_MESSAGES: Record<Exclude<PhoneLinkReason, 'ended'>, string> = {
  off: '',
  'waiting-phone': 'Aponte a câmera do celular para o QR code para parear.',
  checking: 'Celular conectado. Verificando o sensor...',
  ok: 'Celular conectado e pronto.',
  reconnecting: 'Reconectando este aparelho ao servidor...',
  'phone-reconnecting': 'O celular desconectou. Aguardando reconexão...',
  'phone-hidden': 'A tela do celular apagou ou trocou de aplicativo. Deixe a página do controle aberta.',
  sensor: 'O sensor do celular parou de responder. Confira a página do controle.',
  'no-response': 'Controle sem resposta. Confira o celular e a rede.',
};

/** Initial values for real-device trials (docs/19 §4 P0.2); tune from recorded sessions. */
export const HEALTH_TIMEOUT_MS = 3000;
const TICK_MS = 500;

export function evaluatePhoneLink(
  link: ViewerLink | null,
  now: number,
  { healthTimeoutMs = HEALTH_TIMEOUT_MS }: { healthTimeoutMs?: number } = {},
): PhoneLinkStatus {
  const status = (reason: PhoneLinkReason, paired: boolean, message?: string): PhoneLinkStatus => ({
    session: link !== null,
    paired,
    operational: reason === 'ok',
    reason,
    message: message ?? (reason === 'ended' ? ENDED_DEFAULT : PHONE_LINK_MESSAGES[reason]),
  });
  if (!link) return status('off', false);
  if (link.state === 'rejected' || link.state === 'replaced' || link.state === 'closed') {
    const reason = link.closeReason ?? link.lastError ?? '';
    return status('ended', false, ENDED_MESSAGES[reason] ?? ENDED_DEFAULT);
  }
  if (!link.joined) return status('reconnecting', link.everPaired);
  if (!link.everPaired) return status('waiting-phone', false);
  if (!link.controllerPresent) return status('phone-reconnecting', true);
  // Only the current connection's own beacons prove its sensor works.
  const health = link.lastHealth && link.lastHealth.generation === link.generation ? link.lastHealth : null;
  if (!health) {
    const since = link.controllerSince ?? now;
    return status(now - since < healthTimeoutMs ? 'checking' : 'no-response', true);
  }
  if (now - health.receivedAt > healthTimeoutMs) return status('no-response', true);
  if (!health.visible) return status('phone-hidden', true);
  if (health.sensor !== 'ok') return status('sensor', true);
  return status('ok', true);
}

const sameStatus = (a: PhoneLinkStatus, b: PhoneLinkStatus) =>
  a.reason === b.reason && a.session === b.session && a.paired === b.paired && a.message === b.message;

interface CoordinatorOptions {
  input: InputManager;
  bus: EventBus;
  /** Re-attaches the keyboard/touch adapters whenever phone input is not engaged. */
  restoreDefaultInput: () => void;
  startSession?: (options: { onDiagnostic?: DiagnosticSink }) => PhoneControlHandle;
  now?: () => number;
  setIntervalFn?: (fn: () => void, ms: number) => unknown;
  clearIntervalFn?: (id: unknown) => void;
  healthTimeoutMs?: number;
  onDiagnostic?: DiagnosticSink;
}

/**
 * Phone-control mode (docs/12, docs/19): the single owner of the pairing
 * session and of the swap between keyboard/touch and AutoRun+Phone input.
 *
 *  - Operational health is judged here from the viewer link (own socket
 *    joined, phone present, recent beacon with sensor ok and page visible),
 *    re-evaluated on every link event and every 500 ms with this device's
 *    monotonic clock.
 *  - While engaged in a match, losing health pauses the game once (reusing the
 *    APP_BLURRED pause path); commands are dropped unless engaged AND healthy.
 *  - The menu disengages (keyboard/touch back, remote jumps ignored) without
 *    ending the pairing; only `stop()` — "Desconectar celular" — ends it, and a
 *    session the server ended is cleaned up as soon as no match needs its message.
 */
export class PhoneControlCoordinator {
  private _handle: PhoneControlHandle | null = null;
  private _engaged = false;
  private _armed = false;
  private _status: PhoneLinkStatus;
  private _input: InputManager;
  private _bus: EventBus;
  private _restoreDefaultInput: () => void;
  private _startSession: NonNullable<CoordinatorOptions['startSession']>;
  private _now: () => number;
  private _setInterval: (fn: () => void, ms: number) => unknown;
  private _clearInterval: (id: unknown) => void;
  private _healthTimeoutMs: number;
  private _diag: DiagnosticSink;
  private _ticker: unknown = null;
  private _offLink: (() => void) | null = null;
  private _listeners = new Set<(status: PhoneLinkStatus) => void>();

  constructor({
    input,
    bus,
    restoreDefaultInput,
    startSession = startPhoneControlSession,
    now = () => performance.now(),
    setIntervalFn = (fn, ms) => setInterval(fn, ms),
    clearIntervalFn = (id) => clearInterval(id as ReturnType<typeof setInterval>),
    healthTimeoutMs = HEALTH_TIMEOUT_MS,
    onDiagnostic = () => {},
  }: CoordinatorOptions) {
    this._input = input;
    this._bus = bus;
    this._restoreDefaultInput = restoreDefaultInput;
    this._startSession = startSession;
    this._now = now;
    this._setInterval = setIntervalFn;
    this._clearInterval = clearIntervalFn;
    this._healthTimeoutMs = healthTimeoutMs;
    this._diag = onDiagnostic;
    this._status = evaluatePhoneLink(null, now());
  }

  /** True while a phone is paired to this game (possibly reconnecting): phone mode is selected. */
  get isActive(): boolean {
    return this._handle !== null && (this._status.paired || (this._engaged && this._status.reason === 'ended'));
  }

  /** True while phone input drives a match (between engage() and disengage()). */
  get isEngaged(): boolean {
    return this._engaged;
  }

  get status(): PhoneLinkStatus {
    return this._status;
  }

  /** A match may run (or resume) only when this is true. */
  get canPlay(): boolean {
    return !this._engaged || this._status.operational;
  }

  /** Current pairing details, to show the QR/status again without creating a new session. */
  get pairing(): { session: string; pairingUrl: string; measureLatency(): Promise<number | null> } | null {
    const handle = this._handle;
    if (!handle) return null;
    return { session: handle.session, pairingUrl: handle.pairingUrl, measureLatency: () => handle.transport.measureLatency() };
  }

  onStatusChange(listener: (status: PhoneLinkStatus) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** New pairing session (a new QR). Ends any previous one first. */
  start(): { session: string; pairingUrl: string; measureLatency(): Promise<number | null> } {
    this.stop();
    const handle = this._startSession({ onDiagnostic: this._diag });
    this._handle = handle;
    this._offLink = handle.transport.onLinkChange(() => this._evaluate());
    this._ticker = this._setInterval(() => this._evaluate(), TICK_MS);
    this._evaluate();
    return this.pairing!;
  }

  /** "Desconectar celular": ends the session for both sides and restores keyboard/touch. */
  stop(): void {
    const handle = this._handle;
    this._handle = null;
    if (this._ticker) this._clearInterval(this._ticker);
    this._ticker = null;
    this._offLink?.();
    this._offLink = null;
    if (handle) {
      handle.transport.leave();
      handle.transport.dispose();
    }
    this.disengage();
    this._evaluate();
  }

  /**
   * Entering a match: phone input replaces keyboard/touch. Returns whether it
   * did (false when no phone is paired). Callers pause right away when
   * `canPlay` is false.
   */
  engage(): boolean {
    if (!this.isActive || !this._handle) return false;
    if (!this._engaged) {
      this._engaged = true;
      const transport = this._handle.transport;
      this._input.setAdapter(
        new CompositeAdapter(this._input.handleAction, [
          new AutoRunAdapter(this._input.handleAction),
          new PhoneAdapter(this._input.handleAction, {
            transport,
            isArmed: () => this._engaged && this._status.operational,
          }),
        ]),
      );
      this._diag('phone-engaged');
    }
    this._updateArmed();
    return true;
  }

  /** The match resumes from a pause: jumps made while it was paused must not land now. */
  rearm(): void {
    if (this._armed) this._handle?.transport.armAt?.(this._now());
  }

  /** Leaving the match (menu, practice): keyboard/touch back, pairing kept. */
  disengage(): void {
    if (this._engaged) {
      this._engaged = false;
      this._restoreDefaultInput();
      this._diag('phone-disengaged');
    }
    this._updateArmed();
    // An ended session has nothing left to explain once no match shows it.
    if (this._handle && this._status.reason === 'ended') this.stop();
  }

  /**
   * Remote jumps count only from the moment a match can take them: every time
   * it (re)starts accepting commands, anything the phone sent before is late.
   */
  private _updateArmed(): void {
    const armed = this._engaged && this._status.operational;
    if (armed && !this._armed) this._handle?.transport.armAt?.(this._now());
    this._armed = armed;
  }

  private _evaluate(): void {
    const next = evaluatePhoneLink(this._handle?.transport.link ?? null, this._now(), { healthTimeoutMs: this._healthTimeoutMs });
    const previous = this._status;
    if (sameStatus(previous, next)) return;
    this._status = next;
    this._diag('link-status', { reason: next.reason, operational: next.operational });
    if (this._engaged && previous.operational && !next.operational) {
      // Pause the match before anyone can run into an obstacle unwatched.
      this._input.reset();
      this._bus.emit(Events.APP_BLURRED);
    }
    this._updateArmed();
    this._bus.emit(Events.PHONE_LINK_CHANGED, { session: next.session, paired: next.paired, operational: next.operational });
    for (const listener of [...this._listeners]) listener(next);
    if (!this._engaged && next.reason === 'ended' && this._handle) this.stop();
  }
}
