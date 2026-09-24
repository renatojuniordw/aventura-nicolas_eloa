import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { promptPwaInstall } from '../pwa-install.js';
import { useFullscreen, usePwaInstallable } from '../hooks.js';
import { vibrateTap } from '../../input/haptics.js';

interface SettingsOptions {
  onOpenPhonePairing: () => void;
  onResetProgress: () => void;
  onBack: () => void;
}

function SettingsScreen({ onOpenPhonePairing, onResetProgress, onBack }: SettingsOptions) {
  const installable = usePwaInstallable();
  const { supported, fullscreen, toggle: toggleFullscreen } = useFullscreen();

  return (
    <div className="menu-modal-screen">
      <div className="overlay settings-screen">
        <h2>Configurações</h2>
        <p className="settings-help">O botão ⛶ no canto superior direito entra e sai da tela cheia. No computador, Esc também sai.</p>
        {!supported && <p className="settings-help">Neste navegador a tela cheia não está disponível. Para abrir sem a barra de endereço, use “Adicionar à Tela de Início” no menu do navegador, quando disponível.</p>}
        <div className="overlay-actions settings-actions">
          {installable && <MenuButton className="btn-util" onClick={async () => { await promptPwaInstall(); }}>Instalar no celular</MenuButton>}
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
