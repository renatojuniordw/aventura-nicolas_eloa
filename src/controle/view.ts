import { el, clear } from '../ui/dom.js';
import { statusMessage, canRetry, isReady, wakeLockMessage, type AppState } from './status-message.js';

/**
 * DOM of the /controle page (docs/12 §5, docs/19 §4 P1.1, docs/22 M20), as a
 * pure function of a view model: main.ts owns state and effects, this module
 * only draws — which is also what lets tools/ux-audit.mjs mount every state.
 *
 * One task per stage: a single primary action at a time (start/retry, or
 * "Ativar modo bolsinha" once everything is ready); diagnostics stay folded
 * away at the bottom.
 */
export type PocketMode = 'off' | 'on' | 'confirm';

export interface ControllerViewModel {
  state: AppState;
  pocket: PocketMode;
  /** The secondary diagnostics task has its own screen, so it never competes with the main one. */
  screen?: 'main' | 'diagnostics';
  /** Build/session line kept on screen for photos (docs/12). */
  techLine: string;
  diagnosticsNote?: string;
  /** Full report shown when copying failed, so nothing is lost. */
  diagnosticsFallback?: string | null;
}

export interface ControllerViewHandlers {
  onStart(): void;
  onEnterPocket(): void;
  /** The 2 s hold (or a keyboard activation) completed: ask for confirmation. */
  onPocketUnlockRequest(): void;
  onPocketStay(): void;
  onPocketExit(): void;
  onOpenDiagnostics(): void;
  onCloseDiagnostics(): void;
  onCopyDiagnostics(): void;
  onClearDiagnostics(): void;
}

/** Leaving the pocket mode takes this long a hold, then a confirmation. */
export const POCKET_HOLD_MS = 2000;

export function renderControllerView(root: HTMLElement, model: ControllerViewModel, handlers: ControllerViewHandlers): void {
  clear(root);
  const body = root.ownerDocument.body;
  if (model.pocket !== 'off') {
    body.classList.add('pocket-mode');
    renderPocket(root, model, handlers);
    return;
  }
  body.classList.remove('pocket-mode');
  if (model.screen === 'diagnostics') renderDiagnostics(root, model, handlers);
  else renderMain(root, model, handlers);
}

function renderMain(root: HTMLElement, model: ControllerViewModel, handlers: ControllerViewHandlers): void {
  const { state } = model;
  const items: (Node | string)[] = [
    el('h1', { class: 'controle-title', text: 'Controle por celular' }),
    el('p', { class: 'controle-status', role: 'status', 'aria-live': 'polite', text: statusMessage(state) }),
  ];
  const wake = state.phase === 'listening' || state.phase === 'calibrating' ? wakeLockMessage(state.wakeLock) : '';
  if (wake) items.push(el('p', { class: `controle-wake controle-wake-${state.wakeLock}`, text: wake }));

  if (canRetry(state)) {
    items.push(el('button', { class: 'controle-start-btn', type: 'button', text: 'Toque para começar', onClick: handlers.onStart }));
  } else if (isReady(state)) {
    items.push(
      el('p', { class: 'controle-hint', text: 'Prenda o celular na bolsinha sem apertar os botões laterais.' }),
      el('button', { class: 'controle-start-btn', type: 'button', text: 'Ativar modo bolsinha', onClick: handlers.onEnterPocket }),
    );
  }

  items.push(
    el('button', { class: 'controle-secondary-btn', type: 'button', text: 'Diagnóstico da conexão', onClick: handlers.onOpenDiagnostics }),
    el('p', { class: 'controle-tech-status', text: model.techLine }),
  );
  root.append(...items);
}

/** "Diagnóstico": the persisted event log, copied only on request and never sent anywhere. */
function renderDiagnostics(root: HTMLElement, model: ControllerViewModel, handlers: ControllerViewHandlers): void {
  const note = model.diagnosticsNote ?? '';
  root.append(
    el('h1', { class: 'controle-title', text: 'Diagnóstico da conexão' }),
    el('p', {
      class: 'controle-diagnostics-note',
      text: 'Registro local, sem código da sessão nem dados pessoais. Útil para suporte depois de uma falha.',
    }),
    el('div', { class: 'controle-diagnostics-actions' }, [
      el('button', { type: 'button', text: 'Copiar relatório', onClick: handlers.onCopyDiagnostics }),
      el('button', { type: 'button', text: 'Apagar', onClick: handlers.onClearDiagnostics }),
      el('button', { type: 'button', 'data-autofocus': '', text: 'Voltar', onClick: handlers.onCloseDiagnostics }),
    ]),
    ...(note ? [el('p', { class: 'controle-diagnostics-note', role: 'status', text: note })] : []),
    ...(model.diagnosticsFallback
      ? [el('textarea', { class: 'controle-diagnostics-text', readonly: true, 'aria-label': 'Relatório de diagnóstico', 'data-scroll-exception': '' }, [model.diagnosticsFallback])]
      : []),
  );
}

/**
 * Modo bolsinha: a dark surface with the minimum status and nothing a stray
 * touch can trigger. Leaving takes a 2 s hold and a confirmation; a keyboard
 * or switch activation (a click without pointer) goes straight to the
 * confirmation, which is the accessible path.
 */
function renderPocket(root: HTMLElement, model: ControllerViewModel, handlers: ControllerViewHandlers): void {
  const { state } = model;
  const ready = isReady(state);
  const items: HTMLElement[] = [
    el('p', { class: `pocket-status ${ready ? 'pocket-status-ok' : 'pocket-status-warn'}`, role: 'status', 'aria-live': 'polite' }, [
      el('span', { class: 'pocket-dot', 'aria-hidden': 'true' }),
      ready ? 'Conectado' : statusMessage(state),
    ]),
  ];
  if (state.wakeLock !== 'active') items.push(el('p', { class: 'pocket-wake', text: wakeLockMessage(state.wakeLock) }));

  if (model.pocket === 'confirm') {
    items.push(
      el('p', { class: 'pocket-confirm-text', text: 'Sair do modo bolsinha?' }),
      el('div', { class: 'pocket-confirm-actions' }, [
        el('button', { type: 'button', class: 'pocket-btn', 'data-autofocus': '', text: 'Continuar protegido', onClick: handlers.onPocketStay }),
        el('button', { type: 'button', class: 'pocket-btn pocket-btn-exit', text: 'Sair', onClick: handlers.onPocketExit }),
      ]),
    );
  } else {
    items.push(holdButton(handlers.onPocketUnlockRequest));
  }
  root.append(...items);
  // The safe choice starts focused, like every destructive confirmation (docs/18 §5).
  root.querySelector<HTMLElement>('[data-autofocus]')?.focus();
}

function holdButton(onComplete: () => void): HTMLElement {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const hold = el('button', {
    type: 'button',
    class: 'pocket-hold',
    'aria-label': 'Sair do modo bolsinha: segure por 2 segundos',
    text: 'Segure 2 s para sair',
  });
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    hold.classList.remove('holding');
  };
  hold.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    hold.classList.add('holding');
    timer = setTimeout(() => {
      timer = null;
      onComplete();
    }, POCKET_HOLD_MS);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) hold.addEventListener(type, cancel);
  hold.addEventListener('contextmenu', (event) => event.preventDefault());
  hold.addEventListener('click', (event) => {
    // detail 0: activated by keyboard or assistive tech, not a tap.
    if ((event as MouseEvent).detail === 0) onComplete();
  });
  return hold;
}
