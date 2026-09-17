import { randomInt } from 'node:crypto';

// Excludes visually ambiguous characters (0/O, 1/I/L) — the code itself is
// never typed by hand (pairing is QR-only, see docs/12), but keeping it
// unambiguous costs nothing and helps if it's ever read aloud for support.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

// 32^8 ≈ 1.1e12 combinations. Long enough that an attacker on the same WiFi
// guessing session codes has no realistic shot at winning the race before
// the real phone joins as controller (see docs/12-controle-por-celular.md §6).
export const SESSION_PATTERN = /^[A-Za-z0-9]{8}$/;

/** Cryptographically random pairing code for a new TV/phone session. */
export function generateSessionId() {
  let id = '';
  for (let i = 0; i < LENGTH; i += 1) {
    id += ALPHABET[randomInt(ALPHABET.length)];
  }
  return id;
}

export function isValidSessionId(session) {
  return typeof session === 'string' && SESSION_PATTERN.test(session);
}
