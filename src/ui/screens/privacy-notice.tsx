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
    <div className="overlay privacy-notice">
      <h2>Um recado para os responsáveis</h2>
      <p>
        O nome da criança e o progresso do jogo ficam guardados só neste aparelho. Nada é
        enviado para a internet nem compartilhado com ninguém.
      </p>
      <p>
        A opção &quot;Zerar progresso&quot; no menu apaga as fases concluídas. Para remover
        também o nome da criança, limpe os dados do site no navegador.
      </p>
      <div className="overlay-actions">
        <button
          className="btn-retro btn-primary-gold"
          type="button"
          tabIndex={-1}
          onClick={blurOnClick(onConfirm)}
        >
          Entendi, pode começar
        </button>
      </div>
    </div>
  );
}

export function buildPrivacyNoticeScreen({ onConfirm }: PrivacyNoticeOptions) {
  const { node, cleanup } = mountScreen(<PrivacyNoticeScreen onConfirm={onConfirm} />);
  return { node, primary: onConfirm, back: null, cleanup };
}
