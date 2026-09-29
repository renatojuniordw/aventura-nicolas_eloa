/*
 * Page side of tools/ux-audit.mjs for the phone-controller page (docs/22 M20):
 * evaluated inside /controle.html (opened without a session, so no socket or
 * sensor is touched), it redraws #controle-root through the page's own view
 * (src/controle/view.ts) in every state of the flow.
 */
(() => {
  const noop = () => {};
  let view = null;
  const handlers = {
    onStart: noop, onEnterPocket: noop, onPocketUnlockRequest: noop, onPocketStay: noop,
    onPocketExit: noop, onOpenDiagnostics: noop, onCloseDiagnostics: noop, onCopyDiagnostics: noop, onClearDiagnostics: noop,
  };
  const base = { connected: true, joinState: 'joined', viewerPresent: true, sensor: 'ok', wakeLock: 'active', roomError: null };
  const techLine = 'session=AB…(8) · sw ativo · execução 3f9a1c20b7e4';
  const report = ['Diagnóstico do controle', 'Execução atual: execução 3f9a1c20b7e4 · controller · versão 0.4.0+abc1234 · navegação reload',
    ...Array.from({ length: 30 }, (_, i) => `  +${i}.0s #${i + 1} socket-disconnect reason=transport close`)].join('\n');

  const states = {
    'controle-idle': { state: { ...base, phase: 'idle', connected: false, joinState: 'idle', viewerPresent: false, sensor: 'none', wakeLock: 'idle' } },
    'controle-permission': { state: { ...base, phase: 'requesting-permission', connected: false, joinState: 'idle' } },
    'controle-permission-denied': { state: { ...base, phase: 'permission-denied' } },
    'controle-invalid-link': { state: { ...base, phase: 'invalid-link' } },
    'controle-calibrating': { state: { ...base, phase: 'calibrating', wakeLock: 'requesting' } },
    'controle-sensor-failed': { state: { ...base, phase: 'sensor-failed' } },
    'controle-joining': { state: { ...base, phase: 'listening', joinState: 'joining', viewerPresent: false } },
    'controle-waiting-game': { state: { ...base, phase: 'listening', joinState: 'waiting-room', viewerPresent: false, wakeLock: 'unavailable' } },
    'controle-offline': { state: { ...base, phase: 'listening', connected: false, joinState: 'connecting' } },
    'controle-sensor-stale': { state: { ...base, phase: 'listening', sensor: 'stale', wakeLock: 'released' } },
    'controle-ready': { state: { ...base, phase: 'listening' } },
    'controle-room-error': { state: { ...base, phase: 'listening', roomError: 'A sessão expirou. Gere um novo QR code na tela do jogo.' } },
    'controle-diagnostics': { state: { ...base, phase: 'listening' }, screen: 'diagnostics' },
    'controle-diagnostics-fallback': { state: { ...base, phase: 'listening' }, screen: 'diagnostics', diagnosticsNote: 'Não foi possível copiar: o relatório aparece abaixo.', diagnosticsFallback: report },
    'controle-pocket': { state: { ...base, phase: 'listening' }, pocket: 'on' },
    'controle-pocket-warn': { state: { ...base, phase: 'listening', sensor: 'stale', wakeLock: 'error' }, pocket: 'on' },
    'controle-pocket-confirm': { state: { ...base, phase: 'listening' }, pocket: 'confirm' },
  };

  window.__uxAudit = {
    async list({ largeText, textScale = 1, highContrast = false } = {}) {
      if (highContrast) document.documentElement.dataset.contrast = 'high';
      view = await import('/src/controle/view.ts');
      if (largeText) document.documentElement.style.fontSize = '125%';
      if (textScale > 1) document.documentElement.style.fontSize = `${textScale * 100}%`;
      return Object.keys(states);
    },
    async show(name) {
      const { state, pocket = 'off', screen = 'main', diagnosticsNote = '', diagnosticsFallback = null } = states[name];
      view.renderControllerView(document.getElementById('controle-root'), { state, pocket, screen, techLine, diagnosticsNote, diagnosticsFallback }, handlers);
    },
  };
})();
