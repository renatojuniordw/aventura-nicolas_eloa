import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Guard for a destructive action (docs/18 §5): Cancelar is the first focus and
 * the keyboard/gesture default, so a stray Enter or jump never destroys data.
 */
export function buildConfirmScreen({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmOptions) {
  return buildScreen(
    <div className="overlay confirm-screen">
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="overlay-actions">
        <MenuButton className="primary" data-autofocus="" onClick={onCancel}>
          Cancelar
        </MenuButton>
        <MenuButton onClick={onConfirm}>
          {confirmLabel}
        </MenuButton>
      </div>
    </div>,
    { primary: onCancel, back: onCancel },
  );
}
