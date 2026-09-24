import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { getInstallPlatform, isStandalone, promptPwaInstall } from '../pwa-install.js';
import { usePwaInstallable } from '../hooks.js';

interface InstallGuideOptions { onBack: () => void; }

function InstallGuide({ onBack }: InstallGuideOptions) {
  const installable = usePwaInstallable();
  const platform = getInstallPlatform();
  const standalone = isStandalone();
  return <div className="menu-modal-screen"><div className="overlay install-guide">
    <h2>Instalar no celular</h2>
    {standalone ? <p className="install-success" role="status">✓ O jogo já está aberto como aplicativo.</p> : platform === 'ios' ? <ol>
      <li>Abra esta página no <strong>Safari</strong>.</li>
      <li>Toque em <strong>Compartilhar</strong> <span aria-hidden="true">▢↑</span>.</li>
      <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
      <li>Toque em <strong>Adicionar</strong> e abra pelo novo ícone.</li>
    </ol> : <p>{installable ? 'O navegador está pronto para instalar o jogo.' : 'Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.'}</p>}
    <p className="settings-help">Instalado, o jogo abre sem a barra do navegador e continua disponível offline depois do primeiro carregamento completo.</p>
    <div className="overlay-actions">
      {installable && !standalone && <MenuButton className="btn-retro btn-primary-gold" onClick={() => void promptPwaInstall()}>Instalar agora</MenuButton>}
      <MenuButton className="btn-util" onClick={onBack}>Voltar</MenuButton>
    </div>
  </div></div>;
}

export function buildInstallGuide(options: InstallGuideOptions) {
  return buildScreen(<InstallGuide {...options} />, { back: options.onBack });
}
