import type { ReactNode } from 'react';
import { buildScreen } from './mount-screen.js';
import { fitCount, PaginationControls, useArea, usePager } from './layout.js';
import { MenuButton } from './menu-button.js';
import { getInstallPlatform, isStandalone, promptPwaInstall } from '../pwa-install.js';
import { usePwaInstallable } from '../hooks.js';

interface InstallGuideOptions { onBack: () => void; }

const IOS_STEPS: Array<{ id: string; text: ReactNode }> = [
  { id: 'safari', text: <>Abra esta página no <strong>Safari</strong>.</> },
  { id: 'share', text: <>Toque em <strong>Compartilhar</strong> <span aria-hidden="true">▢↑</span>.</> },
  { id: 'add', text: <>Escolha <strong>Adicionar à Tela de Início</strong>.</> },
  { id: 'open', text: <>Toque em <strong>Adicionar</strong> e abra pelo novo ícone.</> },
];

function InstallGuide({ onBack }: InstallGuideOptions) {
  const installable = usePwaInstallable();
  const platform = getInstallPlatform();
  const standalone = isStandalone();
  const area = useArea();
  // The iOS steps go one page at a time only when the screen is too short for all four.
  const pager = usePager({
    id: 'install-steps',
    items: IOS_STEPS,
    getId: (step) => step.id,
    capacity: fitCount(area.height - 13 * area.rem, 2.75 * area.rem, 0.5 * area.rem),
  });
  return <div className="menu-modal-screen"><div className="overlay screen install-guide">
    <h2>Instalar no celular</h2>
    {standalone ? <p className="install-success" role="status">✓ O jogo já está aberto como aplicativo.</p> : platform === 'ios' ? <>
      <ol start={pager.page * pager.capacity + 1}>{pager.items.map((step) => <li key={step.id}>{step.text}</li>)}</ol>
      <PaginationControls pager={pager} label="Passos da instalação" itemNoun="Passo" />
    </> : <p>{installable ? 'O navegador está pronto para instalar o jogo.' : 'Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.'}</p>}
    <p className="settings-help">Instalado, o jogo abre sem a barra do navegador e continua disponível offline depois do primeiro carregamento completo. Não é preciso instalar para jogar.</p>
    <div className="overlay-actions">
      {installable && !standalone && <MenuButton className="btn-retro btn-primary-gold" data-autofocus="" onClick={() => void promptPwaInstall()}>Instalar agora</MenuButton>}
      <MenuButton data-nav-id="back" onClick={onBack}>Voltar</MenuButton>
    </div>
  </div></div>;
}

export function buildInstallGuide(options: InstallGuideOptions) {
  return buildScreen(<InstallGuide {...options} />, { back: options.onBack });
}
