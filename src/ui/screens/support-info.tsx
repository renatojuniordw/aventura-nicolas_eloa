import { useEffect, useRef, useState } from 'react';
import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { PaginationControls, panelBox, useArea, useBoxSize, usePager } from './layout.js';

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

/** `.support-report`: font size in rem, line height, and padding + border in px. */
const REPORT_FONT_REM = 0.8125;
const REPORT_LINE = 1.5;
const REPORT_BOX_PX = 26;
/** Title, help, status, pager and the action grid around the report, in rem (first layout only). */
const CHROME_REM = 20;

/**
 * How many report lines fit in `box`, counting a line that wraps as the
 * rows it takes (monospace, so about 0.62em per character) — the page
 * never grows past its box, whatever the line lengths.
 */
function linesPerPage(lines: string[], box: { width: number; height: number }, rem: number): number {
  const fontPx = REPORT_FONT_REM * rem;
  const columns = Math.max(10, Math.floor((box.width - REPORT_BOX_PX) / (fontPx * 0.62)));
  const tallest = Math.max(1, ...lines.map((line) => Math.ceil(Math.max(1, line.length) / columns)));
  // A little slack per line absorbs sub-pixel line boxes.
  const rows = Math.floor((box.height - REPORT_BOX_PX) / (fontPx * REPORT_LINE + 0.5));
  return Math.max(1, Math.floor(rows / tallest));
}

/**
 * Secondary screen for adults (docs/18 §10), reached from Configurações and
 * never from the child's HUD. The report is shown a page of lines at a time
 * so the screen never scrolls (docs/22 M14); "Copiar resumo" always copies
 * the whole report. When the clipboard is unavailable or refused, the whole
 * report appears as selectable text in one scrollable box — the one
 * documented scroll exception of the menus — and is selected for the
 * system "Copiar".
 */
function SupportInfoScreen({ report, measuring, onToggleMeasuring, onRefresh, onBack, copy }: SupportInfoOptions) {
  const [status, setStatus] = useState('');
  const [fallback, setFallback] = useState(false);
  const fullRef = useRef<HTMLTextAreaElement>(null);
  const area = useArea();
  const body = useRef<HTMLDivElement>(null);
  const box = useBoxSize(body, panelBox(area, CHROME_REM));
  const lines = report.split('\n').map((text, index) => ({ id: String(index), text }));
  const pager = usePager({
    id: 'support-report',
    items: lines,
    getId: (line) => line.id,
    capacity: linesPerPage(lines.map((line) => line.text), box, area.rem),
  });

  useEffect(() => {
    if (!fallback) return;
    fullRef.current?.focus();
    fullRef.current?.select();
  }, [fallback]);

  const copyReport = async () => {
    if (await copy(report)) {
      setStatus('Resumo copiado.');
      return;
    }
    setFallback(true);
    setStatus('Não foi possível copiar automaticamente. O texto completo foi selecionado: use “Copiar” do aparelho.');
  };

  return <div className="menu-modal-screen"><div className="overlay screen screen-fill support-screen">
    <h2>Informações para suporte</h2>
    <p className="settings-help">Versão, tela e controles deste aparelho, sem nomes nem progresso. Nada é enviado sozinho.</p>
    <div className="screen-body support-report-body" ref={body}>
      {fallback ? (
        <textarea ref={fullRef} className="support-report support-report-full" readOnly value={report} aria-label="Resumo técnico completo" data-scroll-exception="" />
      ) : (
        <pre className="support-report" tabIndex={0} aria-label="Resumo técnico">{pager.items.map((line) => line.text).join('\n')}</pre>
      )}
    </div>

    {/* One status line, only when there is something to say (the measure button names its own state). */}
    <p className="settings-help" role="status">{status || (measuring ? 'Medindo também durante as fases. Toque em Atualizar para ver os números.' : '')}</p>
    <div className="screen-nav">
    {!fallback && <PaginationControls pager={pager} label="Páginas do resumo" />}
    <div className="overlay-actions">
      <MenuButton className="btn-util" data-autofocus="" onClick={() => void copyReport()}><span aria-hidden="true">📋 </span>Copiar resumo</MenuButton>
      <MenuButton className="btn-util" data-nav-id="measure" onClick={onToggleMeasuring}>{measuring ? 'Parar medição' : 'Medir fluidez'}</MenuButton>
      <MenuButton className="btn-util" onClick={onRefresh}><span aria-hidden="true">↻ </span>Atualizar</MenuButton>
      <MenuButton data-nav-id="back" onClick={onBack}>Voltar</MenuButton>
    </div>
    </div>
  </div></div>;
}

export function buildSupportInfoScreen(options: SupportInfoOptions) {
  return buildScreen(<SupportInfoScreen {...options} />, { back: options.onBack });
}
