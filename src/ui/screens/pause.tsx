import { mountScreen, blurOnClick } from './mount-screen.js';

export type PauseStep = 'menu' | 'confirm-restart' | 'confirm-menu';

interface PauseOptions {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  isSpeedrun?: boolean;
  isMuted?: boolean;
  onToggleMute: () => void;
}

function PauseMenuStep({ onResume, onRestart, onMenu, isMuted, onToggleMute, goTo }: PauseOptions & { goTo: (step: PauseStep) => void }) {
  return (
    <div className="overlay">
      <h2>Pausa</h2>
      <p>Respire fundo e continue quando quiser.</p>
      <div className="overlay-actions">
        <button type="button" tabIndex={-1} className="primary" onClick={blurOnClick(onResume)}>
          Continuar
        </button>
        <button type="button" tabIndex={-1} onClick={blurOnClick(() => goTo('confirm-restart'))}>
          Recomeçar fase
        </button>
        <button type="button" tabIndex={-1} onClick={blurOnClick(() => goTo('confirm-menu'))}>
          Menu
        </button>
        <button type="button" tabIndex={-1} onClick={blurOnClick(onToggleMute)}>
          {isMuted ? '🔇 Som: Mudo' : '🔈 Som: Ligado'}
        </button>
      </div>
    </div>
  );
}

function PauseConfirmStep({
  isRestart,
  isSpeedrun,
  confirmAction,
  goTo,
}: {
  isRestart: boolean;
  isSpeedrun: boolean;
  confirmAction: () => void;
  goTo: (step: PauseStep) => void;
}) {
  const message = isRestart
    ? isSpeedrun
      ? 'Você vai perder o tempo desta corrida e recomeçar do zero.'
      : 'Você vai perder o progresso desta fase.'
    : 'Você vai voltar para o menu e perder o progresso desta fase.';

  return (
    <div className="overlay">
      <h2>Tem certeza?</h2>
      <p>{message}</p>
      <div className="overlay-actions">
        <button type="button" tabIndex={-1} className="primary" onClick={blurOnClick(confirmAction)}>
          Sim, confirmar
        </button>
        <button type="button" tabIndex={-1} onClick={blurOnClick(() => goTo('menu'))}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * The pause screen is a tiny state machine rendered into the same overlay
 * node: 'menu' (default) or a 'confirm-restart'/'confirm-menu' step that
 * guards the two destructive actions. There is no overlay-stacking mechanism
 * in `MenuOverlay`, so re-rendering in place (via `goTo`, driven by
 * `MenuOverlay._renderPauseScreen`) is simpler than mounting a second screen
 * on top — the step lives outside this component, passed in as a prop, not
 * as local React state.
 *
 * @param goTo re-renders this screen at `nextStep`
 */
export function buildPauseScreen(
  step: PauseStep | string,
  { onResume, onRestart, onMenu, isSpeedrun = false, isMuted = false, onToggleMute }: PauseOptions,
  goTo: (step: PauseStep) => void,
) {
  if (step === 'menu') {
    const { node, cleanup } = mountScreen(
      <PauseMenuStep
        onResume={onResume}
        onRestart={onRestart}
        onMenu={onMenu}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        goTo={goTo}
      />,
    );
    return { node, primary: onResume, back: onResume, cleanup };
  }

  const isRestart = step === 'confirm-restart';
  const confirmAction = isRestart ? onRestart : onMenu;

  const { node, cleanup } = mountScreen(
    <PauseConfirmStep isRestart={isRestart} isSpeedrun={isSpeedrun} confirmAction={confirmAction} goTo={goTo} />,
  );
  return { node, primary: confirmAction, back: () => goTo('menu'), cleanup };
}
