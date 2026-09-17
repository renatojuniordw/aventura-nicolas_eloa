import { describe, it, expect } from 'vitest';
import { statusMessage, canRetry } from './status-message.js';

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

  it('shows the listening message once calibrated and connected', () => {
    const message = statusMessage(state({ phase: 'listening', connected: true }));
    expect(message).toMatch(/pronto/i);
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
