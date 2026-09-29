import { describe, it, expect } from 'vitest';
import { statusMessage, canRetry, isReady, roomErrorFor, wakeLockMessage } from './status-message.js';

function state(overrides = {}) {
  return { phase: 'idle', connected: false, roomError: null, ...overrides };
}

describe('statusMessage', () => {
  it('a socket connecting mid-calibration never clobbers the calibrating message', () => {
    // Regression: onConnectionChange firing between transport.connect() and
    // the calibrating-phase render used to overwrite it with "Conectado!".
    const message = statusMessage(state({ phase: 'calibrating', connected: true }));
    expect(message).toMatch(/calibrando/i);
  });

  it('says "Pronto" only with the room confirmed, the game present and the sensor fresh', () => {
    const ready = state({ phase: 'listening', connected: true, joinState: 'joined', viewerPresent: true, sensor: 'ok' });
    expect(statusMessage(ready)).toMatch(/pronto/i);
    expect(isReady(ready)).toBe(true);
  });

  it.each([
    [{ joinState: 'joining' }, /conectando à sala/i],
    [{ joinState: 'waiting-room' }, /esperando o jogo/i],
    [{ viewerPresent: false }, /tela do jogo não está conectada/i],
    [{ sensor: 'stale' }, /sensor sem resposta/i],
    [{ sensor: 'none' }, /sensor sem resposta/i],
  ])('never says "Pronto" when %o', (patch, expected) => {
    const s = state({ phase: 'listening', connected: true, joinState: 'joined', viewerPresent: true, sensor: 'ok', ...patch });
    expect(statusMessage(s)).toMatch(expected);
    expect(statusMessage(s)).not.toMatch(/pronto/i);
    expect(isReady(s)).toBe(false);
  });

  it('a failed calibration asks to try again instead of listening', () => {
    const s = state({ phase: 'sensor-failed', connected: true });
    expect(statusMessage(s)).toMatch(/sensor de movimento não respondeu/i);
    expect(canRetry(s)).toBe(true);
  });

  it('shows a reconnecting message while listening but disconnected', () => {
    const message = statusMessage(state({ phase: 'listening', connected: false }));
    expect(message).toMatch(/conexão perdida/i);
  });

  it('shows a reconnecting message while calibrating but disconnected', () => {
    const message = statusMessage(state({ phase: 'calibrating', connected: false }));
    expect(message).toMatch(/conexão perdida/i);
  });

  it('a room error takes priority over the connected/calibrating message', () => {
    const message = statusMessage(
      state({ phase: 'listening', connected: true, roomError: 'A partida terminou.' }),
    );
    expect(message).toBe('A partida terminou.');
  });

  it('an invalid link message wins over everything else', () => {
    const message = statusMessage(state({ phase: 'invalid-link', connected: true, roomError: 'x' }));
    expect(message).toMatch(/link inválido/i);
  });

  it('shows the idle prompt before the child taps start', () => {
    expect(statusMessage(state({ phase: 'idle' }))).toMatch(/toque no botão/i);
  });

  it('shows a permission message while the permission gate is pending', () => {
    expect(statusMessage(state({ phase: 'requesting-permission' }))).toMatch(/permiss/i);
  });

  it('shows a denial message when the sensor permission was refused', () => {
    expect(statusMessage(state({ phase: 'permission-denied' }))).toMatch(/negada/i);
  });
});

describe('canRetry', () => {
  it('offers the start button on idle, invalid-link, permission-denied or a room error', () => {
    expect(canRetry(state({ phase: 'idle' }))).toBe(true);
    expect(canRetry(state({ phase: 'invalid-link' }))).toBe(true);
    expect(canRetry(state({ phase: 'permission-denied' }))).toBe(true);
    expect(canRetry(state({ phase: 'listening', roomError: 'A partida terminou.' }))).toBe(true);
  });

  it('hides the start button mid-flow', () => {
    expect(canRetry(state({ phase: 'requesting-permission' }))).toBe(false);
    expect(canRetry(state({ phase: 'calibrating' }))).toBe(false);
    expect(canRetry(state({ phase: 'listening' }))).toBe(false);
  });
});

describe('wakeLockMessage', () => {
  it('claims protection only while a lock is held', () => {
    expect(wakeLockMessage('active')).toMatch(/protegida/i);
    for (const st of ['unavailable', 'released', 'error']) {
      expect(wakeLockMessage(st)).not.toMatch(/protegida contra apagar\./i);
      expect(wakeLockMessage(st)).toMatch(/bloqueio automático/i);
    }
  });
});

describe('roomErrorFor', () => {
  it('is null while the session is still usable', () => {
    expect(roomErrorFor('joined', null)).toBeNull();
    expect(roomErrorFor('waiting-room', 'room-not-found')).toBeNull();
  });

  it('explains each terminal reason', () => {
    expect(roomErrorFor('rejected', 'room-full')).toMatch(/outro celular/i);
    expect(roomErrorFor('closed', 'expired')).toMatch(/expirou/i);
    expect(roomErrorFor('replaced', 'replaced')).toMatch(/outra aba/i);
  });
});
