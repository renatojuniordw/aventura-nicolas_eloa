import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { useFullscreen } from '../hooks.js';
import { vibrateTap } from '../../input/haptics.js';

interface SettingsOptions {
  onOpenPhonePairing: () => void;
  onResetProgress: () => void;
  onBack: () => void;
}

function SettingsScreen({ onOpenPhonePairing, onResetProgress, onBack }: SettingsOptions) {
  const { supported, fullscreen, toggle: toggleFullscreen } = useFullscreen();

  return (
    <div className="menu-modal-screen">
      <div className="overlay settings-screen">
        <h2>Configurações</h2>
        <div className="overlay-actions settings-actions">
          {supported && (
            <MenuButton

              className="btn-util"
              onClick={() => {
                vibrateTap();
                return toggleFullscreen();
              }}
            >
              {fullscreen ? '🗗 Sair da tela cheia' : '⛶ Modo tela cheia'}
            </MenuButton>
          )}
          <MenuButton

            className="btn-util"
            onClick={() => {
              vibrateTap();
              onOpenPhonePairing();
            }}
          >
            📱 Controle por celular
          </MenuButton>
          <MenuButton

            className="btn-util"
            onClick={() => {
              vibrateTap();
              onResetProgress();
            }}
          >
            🗑️ Zerar progresso
          </MenuButton>
          <MenuButton

            className="btn-retro btn-primary-gold"
            onClick={() => {
              vibrateTap();
              onBack();
            }}
          >
            Voltar
          </MenuButton>
        </div>
      </div>
    </div>
  );
}

export function buildSettingsScreen(options: SettingsOptions) {
  return buildScreen(<SettingsScreen {...options} />, { primary: options.onBack, back: options.onBack });
}
