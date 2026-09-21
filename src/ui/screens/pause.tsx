import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';

export type PauseStep = 'menu' | 'confirm-restart' | 'confirm-menu';

interface PauseOptions {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  isSpeedrun?: boolean;
  isMuted?: boolean;
  onToggleMute: () => void;
  /** Controle por celular (docs/12-controle-por-celular.md): lets a parent drop back to keyboard/touch mid-game without abandoning the lesson. */
  isPhoneControlActive?: boolean;
  onDisablePhoneControl?: () => void;
}

function PauseMenuStep({
  onResume,
  onRestart,
  onMenu,
  isMuted,
  onToggleMute,
  isPhoneControlActive,
  onDisablePhoneControl,
  goTo,
}: PauseOptions & { goTo: (step: PauseStep) => void }) {
  return (
    <div className="overlay">
      <h2>Pausa</h2>
      <p>Respire fundo e continue quando quiser.</p>
      <div className="overlay-actions">
        <MenuButton className="primary" onClick={onResume}>
          Continuar
        </MenuButton>
        <MenuButton onClick={() => goTo('confirm-restart')}>
          Recomeçar fase
        </MenuButton>
        <MenuButton onClick={() => goTo('confirm-menu')}>
          Menu
        </MenuButton>
        <MenuButton onClick={onToggleMute}>
          {isMuted ? '🔇 Som: Mudo' : '🔈 Som: Ligado'}
        </MenuButton>
        {isPhoneControlActive ? (
          <MenuButton onClick={onDisablePhoneControl}>
            📱 Desativar controle por celular
          </MenuButton>
        ) : null}
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
        <MenuButton className="primary" onClick={confirmAction}>
          Sim, confirmar
        </MenuButton>
        <MenuButton onClick={() => goTo('menu')}>
          Cancelar
        </MenuButton>
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
  {
    onResume,
    onRestart,
    onMenu,
    isSpeedrun = false,
    isMuted = false,
    onToggleMute,
    isPhoneControlActive = false,
    onDisablePhoneControl,
  }: PauseOptions,
  goTo: (step: PauseStep) => void,
) {
  if (step === 'menu') {
    return buildScreen(
      <PauseMenuStep
        onResume={onResume}
        onRestart={onRestart}
        onMenu={onMenu}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        isPhoneControlActive={isPhoneControlActive}
        onDisablePhoneControl={onDisablePhoneControl}
        goTo={goTo}
      />,
      { primary: onResume, back: onResume },
    );
  }

  const isRestart = step === 'confirm-restart';
  const confirmAction = isRestart ? onRestart : onMenu;

  return buildScreen(
    <PauseConfirmStep isRestart={isRestart} isSpeedrun={isSpeedrun} confirmAction={confirmAction} goTo={goTo} />,
    { primary: confirmAction, back: () => goTo('menu') },
  );
}
