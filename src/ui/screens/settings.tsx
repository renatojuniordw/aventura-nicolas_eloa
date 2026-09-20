import { useState, useEffect } from 'react';
import { mountScreen, blurOnClick } from './mount-screen.js';
import { isFullscreenSupported, isFullscreen, toggleFullscreen, onFullscreenChange } from '../fullscreen.js';

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
    <div className="overlay settings-screen">
      <h2>Configurações</h2>
      <div className="overlay-actions">
        {supported && (
          <button
            type="button"
            tabIndex={-1}
            className="btn-util"
            onClick={blurOnClick(async () => {
              const active = await toggleFullscreen();
              setFullscreen(active);
            })}
          >
            {fullscreen ? '🗗 Sair da tela cheia' : '⛶ Modo tela cheia'}
          </button>
        )}
        <button type="button" tabIndex={-1} className="btn-util" onClick={blurOnClick(onOpenPhonePairing)}>
          📱 Controle por celular
        </button>
        <button type="button" tabIndex={-1} className="btn-util" onClick={blurOnClick(onResetProgress)}>
          🗑️ Zerar progresso
        </button>
        <button type="button" tabIndex={-1} className="primary" onClick={blurOnClick(onBack)}>
          Voltar
        </button>
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
