import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
interface Options { onResume: () => void; onMenu: () => void; onToggleMute: () => void; isMuted: boolean }
export function buildExplorationPause(options: Options) {
  return buildScreen(<section className="overlay" role="dialog" aria-modal="true" aria-labelledby="exploration-pause-title">
    <h2 id="exploration-pause-title">Uma pausa no quintal</h2>
    <p>Suas descobertas estão guardadas. Volte quando quiser!</p>
    <div className="overlay-actions">
      <MenuButton className="btn-primary-gold" onClick={options.onResume}>Continuar explorando</MenuButton>
      <MenuButton onClick={options.onToggleMute}>{options.isMuted ? 'Ligar som' : 'Desligar som'}</MenuButton>
      <MenuButton onClick={options.onMenu}>Voltar ao menu</MenuButton>
    </div>
  </section>, { primary: options.onResume, back: options.onResume });
}
