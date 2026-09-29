import type { JoinState } from '../net/signaling-socket.js';
import type { SensorHealth } from './motion-session.js';
import type { WakeLockState } from './wake-lock-keeper.js';

// `phase` is the page's own flow (permission → calibration → listening); the
// other fields are independent facts that change on their own, often *during*
// a phase. Folding them into one enum caused whichever changed last to
// silently clobber the other's message (e.g. a mid-calibration "connected"
// event overwriting "calibrando...").
export type Phase =
  | 'idle'
  | 'requesting-permission'
  | 'invalid-link'
  | 'permission-denied'
  | 'calibrating'
  | 'sensor-failed'
  | 'listening';

export interface AppState {
  phase: Phase;
  /** The socket itself is up (not proof the room exists). */
  connected: boolean;
  /** Room confirmation, from the server's `joined` answer. */
  joinState?: JoinState;
  /** The game's screen is in the room. */
  viewerPresent?: boolean;
  sensor?: SensorHealth;
  wakeLock?: WakeLockState;
  roomError: string | null;
}

/** Every requirement for "Pronto" (docs/19 §3 item 2): room confirmed, game present, recent valid samples. */
export function isReady(state: AppState): boolean {
  return (
    state.phase === 'listening' &&
    !state.roomError &&
    state.connected &&
    state.joinState === 'joined' &&
    state.viewerPresent === true &&
    state.sensor === 'ok'
  );
}

export function statusMessage(state: AppState): string {
  if (state.phase === 'invalid-link') {
    return 'Link inválido. Peça para gerar um novo QR code na tela do jogo.';
  }
  if (state.phase === 'permission-denied') {
    return 'Permissão negada. Recarregue a página para tentar de novo.';
  }
  if (state.phase === 'sensor-failed') {
    return 'O sensor de movimento não respondeu. Confira se o navegador permite sensores, deixe o celular parado e toque para tentar de novo.';
  }
  if (state.roomError) return state.roomError;
  if (state.phase === 'idle') return 'Toque no botão abaixo para conectar o celular ao jogo.';
  if (state.phase === 'requesting-permission') return 'Pedindo permissão do sensor...';
  if (!state.connected) return 'Conexão perdida. Verifique o WiFi — tentando reconectar...';
  if (state.phase === 'calibrating') return 'Calibrando... deixe o celular parado, já na posição de uso.';
  if (state.joinState === 'waiting-room') return 'Esperando o jogo voltar... mantenha esta página aberta.';
  if (state.joinState !== 'joined') return 'Conectando à sala do jogo...';
  if (!state.viewerPresent) return 'A tela do jogo não está conectada agora. Aguardando ela voltar...';
  if (state.sensor !== 'ok') return 'Sensor sem resposta. Mantenha esta página aberta e com a tela ligada.';
  return 'Pronto! Pule para controlar o personagem.';
}

/** Separate line about screen protection — never claims protection that is not held. */
export function wakeLockMessage(state: WakeLockState | undefined): string {
  switch (state) {
    case 'active':
      return 'Tela protegida contra apagar.';
    case 'requesting':
      return 'Protegendo a tela contra apagar...';
    case 'unavailable':
      return 'Este navegador não mantém a tela ligada: aumente o tempo de bloqueio automático do celular.';
    case 'released':
    case 'error':
      return 'A tela pode apagar sozinha: aumente o tempo de bloqueio automático do celular.';
    default:
      return '';
  }
}

/** Whether the "Toque para começar" button should be offered. */
export function canRetry(state: AppState): boolean {
  return (
    state.phase === 'idle' ||
    state.phase === 'invalid-link' ||
    state.phase === 'permission-denied' ||
    state.phase === 'sensor-failed' ||
    !!state.roomError
  );
}

const ROOM_ERRORS: Record<string, string> = {
  'room-full': 'Outro celular já está pareado com esse jogo.',
  'room-not-found': 'O jogo não abriu esta sala a tempo. Gere um novo QR code na tela do jogo.',
  'version-mismatch': 'O controle e o servidor estão em versões diferentes. Recarregue esta página.',
  expired: 'A sessão expirou. Gere um novo QR code na tela do jogo.',
  ended: 'A partida terminou. Gere um novo QR code para jogar de novo.',
  replaced: 'Este controle foi aberto em outra aba. Use a página mais recente.',
  left: 'Controle desconectado.',
};

/** Message for a terminal join state; null while the session is still usable. */
export function roomErrorFor(joinState: JoinState, reason: string | null): string | null {
  if (joinState !== 'rejected' && joinState !== 'closed' && joinState !== 'replaced') return null;
  return ROOM_ERRORS[reason ?? ''] ?? 'Não foi possível parear. Gere um novo QR code na tela do jogo.';
}
