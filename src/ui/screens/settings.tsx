import { mountScreen, blurOnClick } from './mount-screen.js';

interface SettingsOptions {
  onOpenPhonePairing: () => void;
  onResetProgress: () => void;
  onBack: () => void;
}

function SettingsScreen({ onOpenPhonePairing, onResetProgress, onBack }: SettingsOptions) {
  return (
    <div className="overlay">
      <h2>Configurações</h2>
      <div className="overlay-actions">
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
