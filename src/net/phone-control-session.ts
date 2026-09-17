import { generateSessionCode } from './session-code.js';
import { PhoneViewerTransport } from './phone-viewer-transport.js';

export interface PhoneControlCallbacks {
  /** The phone paired (first time, or a reconnect after a drop). */
  onPaired(): void;
  /** The paired phone dropped — WiFi, backgrounded app, screen lock. */
  onDisconnected(): void;
  /** Server rejected the join (bad/expired session, or already paired to another phone). */
  onError(message: string): void;
}

export interface PhoneControlHandle {
  session: string;
  pairingUrl: string;
  transport: PhoneViewerTransport;
  /** Round-trip time to the signaling server, in ms, or null if unreachable. */
  measureLatency(): Promise<number | null>;
  stop(): void;
}

const JOIN_ERROR_MESSAGES: Record<string, string> = {
  'room-full': 'Outro celular já está pareado com esse jogo.',
};
const DEFAULT_JOIN_ERROR = 'Não foi possível parear. Tente gerar um novo QR code.';

/**
 * Starts a new TV/phone pairing session (docs/12-controle-por-celular.md §6):
 * generates the session code, opens the signaling socket as `viewer`, and
 * builds the QR pairing URL. Deliberately knows nothing about InputManager
 * or the EventBus — swapping in PhoneAdapter/AutoRunAdapter and pausing on
 * disconnect are the caller's job (main.ts), so this stays a pure
 * networking/session concern, independently reusable and testable.
 */
export function startPhoneControlSession(
  callbacks: PhoneControlCallbacks,
  signalingUrl?: string,
): PhoneControlHandle {
  const session = generateSessionCode();
  const transport = new PhoneViewerTransport(session, signalingUrl);

  transport.onPaired(() => callbacks.onPaired());
  transport.onUnpaired(() => callbacks.onDisconnected());
  transport.onJoinError(({ error }) => callbacks.onError(JOIN_ERROR_MESSAGES[error] ?? DEFAULT_JOIN_ERROR));

  transport.connect();

  const pairingUrl = `${window.location.origin}/controle?session=${session}`;

  return {
    session,
    pairingUrl,
    transport,
    measureLatency: () => transport.measureLatency(),
    stop: () => transport.disconnect(),
  };
}

export { JOIN_ERROR_MESSAGES, DEFAULT_JOIN_ERROR };
