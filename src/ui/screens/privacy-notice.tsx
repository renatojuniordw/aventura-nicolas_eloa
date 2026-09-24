import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { vibrateSuccess } from '../../input/haptics.js';

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
    <div className="menu-modal-screen">
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
              O jogo lembra até oito respostas recentes por lição para escolher revisões e dicas.
              A opção &quot;Zerar progresso&quot; no menu apaga as fases concluídas, esse histórico e as descobertas. Para remover
              também o nome da criança, limpe os dados do site no navegador.
            </p>
          </div>
        </details>

        <div className="overlay-actions welcome-actions">
          <MenuButton
            className="btn-retro btn-primary-gold"

            onClick={() => {
              vibrateSuccess();
              onConfirm();
            }}
          >
            Entendi, pode começar
          </MenuButton>
        </div>
        <div className="welcome-storage-note">
          ✓ Sua preferência será lembrada e este aviso não aparecerá de novo.
        </div>
      </div>
    </div>
  );
}

export function buildPrivacyNoticeScreen({ onConfirm }: PrivacyNoticeOptions) {
  return buildScreen(<PrivacyNoticeScreen onConfirm={onConfirm} />, { primary: onConfirm });
}
