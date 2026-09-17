import { isValidSessionCode } from '../net/session-code.js';

export interface ControleParams {
  session: string | null;
  debug: boolean;
}

/** Parses the /controle URL's query string (the QR code target, §6). */
export function parseControleParams(search: string): ControleParams {
  const params = new URLSearchParams(search);
  const rawSession = params.get('session');
  return {
    session: isValidSessionCode(rawSession) ? rawSession : null,
    debug: params.get('debug') === '1',
  };
}
