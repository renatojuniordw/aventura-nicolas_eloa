import { mountScreen, blurOnClick } from './mount-screen.js';

interface PrivacyNoticeOptions {
  onConfirm: () => void;
}

/**
 * Parental notice shown once on first run, before any profile is created.
 * Explains in plain language that the child's name and progress stay on the
 * device and are never sent anywhere. The game only proceeds after the
 * responsible adult confirms.
 */
function PrivacyNoticeScreen({ onConfirm }: PrivacyNoticeOptions) {
  return (
    <div className="overlay privacy-notice welcome-notice">
      <h2>Boas-vindas! Um recado para os responsáveis</h2>
      
      <div className="welcome-highlights">
        <div className="welcome-card">
          <span className="welcome-card-icon" aria-hidden="true">📱</span>
          <div className="welcome-card-body">
            <strong>Modo horizontal</strong>
            <span>Para a melhor experiência, jogue com o celular deitado.</span>
          </div>
        </div>
        <div className="welcome-card">
          <span className="welcome-card-icon" aria-hidden="true">🔒</span>
          <div className="welcome-card-body">
            <strong>Privacidade total</strong>
            <span>O jogo é 100% seguro: dados ficam apenas no seu aparelho.</span>
          </div>
        </div>
      </div>

      <p className="privacy-main-text">
        O nome da criança e o progresso do jogo ficam guardados só neste aparelho. Nada é
        enviado para a internet nem compartilhado com ninguém.
      </p>

      <details className="privacy-details">
        <summary className="privacy-details-summary">Ver mais informações aos responsáveis</summary>
        <div className="privacy-details-content">
          <p>
            A opção &quot;Zerar progresso&quot; no menu apaga as fases concluídas. Para remover
            também o nome da criança, limpe os dados do site no navegador.
          </p>
        </div>
      </details>

      <div className="overlay-actions welcome-actions">
        <button
          className="btn-retro btn-primary-gold"
          type="button"
          tabIndex={-1}
          onClick={blurOnClick(onConfirm)}
        >
          Entendi, pode começar
        </button>
      </div>
      <div className="welcome-storage-note">
        ✓ Sua preferência será lembrada e este aviso não aparecerá de novo.
      </div>
    </div>
  );
}

export function buildPrivacyNoticeScreen({ onConfirm }: PrivacyNoticeOptions) {
  const { node, cleanup } = mountScreen(<PrivacyNoticeScreen onConfirm={onConfirm} />);
  return { node, primary: onConfirm, back: null, cleanup };
}
