import { generateSessionCode } from './session-code.js';
import { PhoneViewerTransport } from './phone-viewer-transport.js';
import type { DiagnosticSink } from './signaling-socket.js';

export interface PhoneControlHandle {
  session: string;
  pairingUrl: string;
  transport: Pick<PhoneViewerTransport, 'link' | 'onLinkChange' | 'onMessage' | 'armAt' | 'leave' | 'dispose' | 'measureLatency'>;
}

/**
 * Starts a new TV/phone pairing session (docs/12-controle-por-celular.md §6):
 * generates the session code, opens the signaling socket as `viewer`, and
 * builds the QR pairing URL. Deliberately knows nothing about InputManager
 * or the EventBus — judging link health, swapping input and pausing belong to
 * PhoneControlCoordinator, so this stays a pure networking/session concern.
 */
export function startPhoneControlSession({
  signalingUrl,
  onDiagnostic,
}: { signalingUrl?: string; onDiagnostic?: DiagnosticSink } = {}): PhoneControlHandle {
  const session = generateSessionCode();
  const transport = new PhoneViewerTransport(session, { url: signalingUrl, onDiagnostic });
  transport.connect();
  return {
    session,
    pairingUrl: `${window.location.origin}/controle?session=${session}`,
    transport,
  };
}
