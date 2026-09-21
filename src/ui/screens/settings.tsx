import { useState, useEffect } from 'react';
import { mountScreen, blurOnClick } from './mount-screen.js';
import { isFullscreenSupported, isFullscreen, toggleFullscreen, onFullscreenChange } from '../fullscreen.js';
import { vibrateTap } from '../../input/haptics.js';

interface SettingsOptions {
  onOpenPhonePairing: () => void;
  onResetProgress: () => void;
  onBack: () => void;
}

function SettingsScreen({ onOpenPhonePairing, onResetProgress, onBack }: SettingsOptions) {
  const [fullscreen, setFullscreen] = useState(() => isFullscreen());
  const supported = isFullscreenSupported();

  useEffect(() => {
    return onFullscreenChange((active) => setFullscreen(active));
  }, []);

  return (
    <div className="menu-modal-screen">
      <div className="overlay settings-screen">
        <h2>Configurações</h2>
        <div className="overlay-actions settings-actions">
          {supported && (
            <button
              type="button"
              tabIndex={-1}
              className="btn-util"
              onClick={blurOnClick(async () => {
                vibrateTap();
                const active = await toggleFullscreen();
                setFullscreen(active);
              })}
            >
              {fullscreen ? '🗗 Sair da tela cheia' : '⛶ Modo tela cheia'}
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            className="btn-util"
            onClick={blurOnClick(() => {
              vibrateTap();
              onOpenPhonePairing();
            })}
          >
            📱 Controle por celular
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="btn-util"
            onClick={blurOnClick(() => {
              vibrateTap();
              onResetProgress();
            })}
          >
            🗑️ Zerar progresso
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="btn-retro btn-primary-gold"
            onClick={blurOnClick(() => {
              vibrateTap();
              onBack();
            })}
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}

export function buildSettingsScreen(options: SettingsOptions) {
  const { node, cleanup } = mountScreen(<SettingsScreen {...options} />);
  return {
    node,
    primary: options.onBack,
    back: options.onBack,
    cleanup,
  };
}
