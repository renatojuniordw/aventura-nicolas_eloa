import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { vibrateSuccess } from '../../input/haptics.js';

interface PrivacyNoticeOptions {
  onConfirm: () => void;
  /** Opens "Informações aos responsáveis"; coming back never counts as consent. */
  onOpenGuardianInfo?: () => void;
}

/**
 * Parental notice shown once on first run, before any profile is created.
 * Explains in plain language that the child's name and progress stay on the
 * device and are never sent anywhere. The game only proceeds after the
 * responsible adult confirms. The details live on their own page (docs/22
 * M11), so this one stays short enough to fit without scrolling.
 */
function PrivacyNoticeScreen({ onConfirm, onOpenGuardianInfo }: PrivacyNoticeOptions) {
  return (
    <div className="menu-modal-screen">
      <div className="overlay screen privacy-notice welcome-notice">
        <h2>Boas-vindas! Um recado para os responsáveis</h2>
        <p className="privacy-main-text">
          O nome da criança e o progresso do jogo ficam guardados só neste aparelho. Nada é
          enviado para a internet nem compartilhado com ninguém.
        </p>
        <div className="welcome-card">
          <span className="welcome-card-icon" aria-hidden="true">📱</span>
          <span className="welcome-card-body">
            <strong>Celular deitado</strong>
            <span>As fases são jogadas com o celular na horizontal.</span>
          </span>
        </div>
        <div className="overlay-actions welcome-actions">
          <MenuButton
            className="btn-retro btn-primary-gold" data-autofocus=""
            onClick={() => {
              vibrateSuccess();
              onConfirm();
            }}
          >
            Entendi, pode começar
          </MenuButton>
          {onOpenGuardianInfo && (
            <MenuButton data-nav-id="guardian-info" onClick={onOpenGuardianInfo}>Informações aos responsáveis</MenuButton>
          )}
        </div>
        <p className="welcome-storage-note">✓ Depois de confirmar, este aviso não aparece de novo.</p>
      </div>
    </div>
  );
}

export function buildPrivacyNoticeScreen({ onConfirm, onOpenGuardianInfo }: PrivacyNoticeOptions) {
  return buildScreen(<PrivacyNoticeScreen onConfirm={onConfirm} onOpenGuardianInfo={onOpenGuardianInfo} />, { primary: onConfirm });
}

interface GuardianInfoOptions {
  onBack: () => void;
}

/**
 * What the game keeps and how to erase it (docs/10), for adults. Reached from
 * the welcome notice and from Configurações → Ajuda e dados; Voltar returns
 * to where it was opened and never confirms anything.
 */
export function buildGuardianInfoScreen({ onBack }: GuardianInfoOptions) {
  return buildScreen(
    <div className="menu-modal-screen">
      <div className="overlay screen guardian-info">
        <h2>Informações aos responsáveis</h2>
        <div className="settings-pages is-split">
          <section className="settings-section" aria-labelledby="guardian-kept">
            <h3 id="guardian-kept">O que fica guardado</h3>
            <p>
              O nome da criança, as fases concluídas e as palavras descobertas, só neste aparelho.
              O jogo também lembra até oito respostas recentes por lição para escolher revisões e dicas.
            </p>
          </section>
          <section className="settings-section" aria-labelledby="guardian-erase">
            <h3 id="guardian-erase">Como apagar</h3>
            <p>
              Em Configurações → Ajuda e dados, “Zerar progresso” apaga fases, histórico, descobertas e
              recorde da corrida. Para apagar também o nome, limpe os dados do site no navegador.
            </p>
          </section>
        </div>
        <div className="overlay-actions screen-foot">
          <MenuButton data-autofocus="" data-nav-id="back" onClick={onBack}>Voltar</MenuButton>
        </div>
      </div>
    </div>,
    { primary: onBack, back: onBack },
  );
}
