import { useRef, useState } from 'react';
import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';

export interface SupportInfoOptions {
  report: string;
  /** Frame-time measurement is running (it keeps running during play until turned off). */
  measuring: boolean;
  onToggleMeasuring: () => void;
  onRefresh: () => void;
  onBack: () => void;
  /** Resolves false when the clipboard is unavailable or refused. */
  copy: (text: string) => Promise<boolean>;
}

/**
 * Secondary screen for adults (docs/18 §10), reached from Configurações and
 * never from the child's HUD. The report is selectable text even though the
 * game blocks selection globally, so a refused clipboard still leaves a way.
 */
function SupportInfoScreen({ report, measuring, onToggleMeasuring, onRefresh, onBack, copy }: SupportInfoOptions) {
  const [status, setStatus] = useState('');
  const reportRef = useRef<HTMLPreElement>(null);

  const copyReport = async () => {
    if (await copy(report)) {
      setStatus('Resumo copiado.');
      return;
    }
    // Fallback: select the text so the system "Copiar" menu takes it.
    const node = reportRef.current;
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    if (node && selection) {
      const range = document.createRange();
      range.selectNodeContents(node);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    setStatus('Não foi possível copiar automaticamente. O texto foi selecionado: use “Copiar” do aparelho.');
  };

  return <div className="menu-modal-screen"><div className="overlay support-screen">
    <h2>Informações para suporte</h2>
    <p className="settings-help">Versão, tela e controles deste aparelho. Não inclui nomes, progresso nem áudio, e nada é enviado sozinho.</p>
    <pre ref={reportRef} className="support-report" tabIndex={0} aria-label="Resumo técnico">{report}</pre>
    <p className="settings-help" role="status">{status}</p>
    <p className="settings-help">{measuring
      ? 'Medindo a fluidez agora, também durante as fases. Volte aqui e toque em Atualizar para ver os números.'
      : 'A medição de fluidez fica desligada até você ligar.'}</p>
    <div className="overlay-actions settings-actions">
      <MenuButton className="btn-util" data-autofocus="" onClick={() => void copyReport()}>📋 Copiar resumo</MenuButton>
      <MenuButton className="btn-util" data-nav-id="measure" onClick={onToggleMeasuring}>{measuring ? '⏹ Parar medição de fluidez' : '⏱ Medir fluidez'}</MenuButton>
      <MenuButton className="btn-util" onClick={onRefresh}>↻ Atualizar</MenuButton>
      <MenuButton className="btn-retro btn-primary-gold" onClick={onBack}>Voltar</MenuButton>
    </div>
  </div></div>;
}

export function buildSupportInfoScreen(options: SupportInfoOptions) {
  return buildScreen(<SupportInfoScreen {...options} />, { back: options.onBack });
}
