// `phase` is the page's own flow (permission → calibration → listening),
// `connected` is the signaling socket's state — kept separate on purpose:
// the socket can connect/drop independently of (and often *during*) any
// phase, and folding both into one enum caused whichever changed last to
// silently clobber the other's message (e.g. a mid-calibration "connected"
// event overwriting "calibrando...").
export type Phase =
  | 'idle'
  | 'requesting-permission'
  | 'invalid-link'
  | 'permission-denied'
  | 'calibrating'
  | 'listening';

export interface AppState {
  phase: Phase;
  connected: boolean;
  roomError: string | null;
}

export function statusMessage(state: AppState): string {
  if (state.phase === 'invalid-link') {
    return 'Link inválido. Peça para gerar um novo QR code na tela do jogo.';
  }
  if (state.phase === 'permission-denied') {
    return 'Permissão negada. Recarregue a página para tentar de novo.';
  }
  if (state.roomError) return state.roomError;
  if (state.phase === 'idle') return 'Toque no botão abaixo para conectar o celular ao jogo.';
  if (state.phase === 'requesting-permission') return 'Pedindo permissão do sensor...';
  if (!state.connected) return 'Conexão perdida. Verifique o WiFi — tentando reconectar...';
  if (state.phase === 'calibrating') return 'Calibrando... fique parado por um instante.';
  return 'Pronto! Pule para controlar o personagem.'; // listening + connected
}

/** Whether the "Toque para começar" button should be offered. */
export function canRetry(state: AppState): boolean {
  return (
    state.phase === 'idle' ||
    state.phase === 'invalid-link' ||
    state.phase === 'permission-denied' ||
    !!state.roomError
  );
}
