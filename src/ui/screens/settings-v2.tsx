import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { useFullscreen, usePwaInstallable } from '../hooks.js';
import { isStandalone } from '../pwa-install.js';
import { fitCount, PaginationControls, panelBox, useArea, useBoxSize, usePager } from './layout.js';
import type { ExperienceSettings, SupportLevel, ColorVisionMode } from '../../persistence/experience-settings-store.js';
import {
  isDefaultTouchLayout,
  type EdgeInset,
  type JumpSide,
  type TouchLayout,
  type TouchSize,
  type TouchVisibility,
} from '../../persistence/touch-layout-store.js';

/*
 * Configurações (docs/22 §4): one entry on the home opens a hub of six
 * destinations; each destination is its own short screen with one
 * responsibility and its own Voltar. Every change still applies (and is
 * stored) immediately — there is no Salvar. Screens re-render through the
 * scene after each change, and navigation context keeps focus and page.
 */

export type SettingsSection = 'audio' | 'support' | 'access' | 'controls' | 'touch' | 'app' | 'help';

export interface TouchSettingsOptions {
  layout: TouchLayout;
  onChange: (patch: Partial<TouchLayout>) => void;
  onReset: () => void;
  /** "Experimentar controles" (docs/18 §8). */
  onPractice?: () => void;
}

export interface SettingsOptions {
  /** Which screen of the tree; the hub when absent. */
  section?: SettingsSection;
  /** Moves within the tree; `null` is the hub. */
  onOpenSection: (section: SettingsSection | null) => void;
  onOpenPhonePairing: () => void; onOpenInstallGuide: () => void; onResetProgress: () => void;
  /** Leaves Configurações (from the hub). */
  onBack: () => void;
  audio: { musicVolume: number; sfxVolume: number; voiceVolume: number };
  experience: ExperienceSettings;
  /** The device itself asks for reduced motion (motion stays reduced whatever the toggle says). */
  systemReducedMotion?: boolean;
  onAudioChange: (category: 'music' | 'sfx' | 'voice', value: number) => void;
  onExperienceChange: (patch: Partial<ExperienceSettings>) => void;
  /** Present on touch devices only (or wherever the buttons were set to always show). */
  touch?: TouchSettingsOptions;
  /** "Botões de toque na tela", offered on every device so a hybrid can turn them on (docs/17 §6). */
  touchVisibility?: { value: TouchVisibility; onChange: (value: TouchVisibility) => void };
  /** "Informações para suporte" (docs/18 §10). */
  onOpenSupport?: () => void;
  /** "Informações aos responsáveis" (docs/22 M11). */
  onOpenGuardianInfo?: () => void;
}

/** Where each screen's Voltar leads. */
export const SETTINGS_PARENT: Record<SettingsSection, SettingsSection | null> = {
  audio: null, support: null, access: null, controls: null, app: null, help: null, touch: 'controls',
};

const DESTINATIONS: Array<{ section: Exclude<SettingsSection, 'touch'>; icon: string; label: string }> = [
  { section: 'audio', icon: '🔊', label: 'Som e narração' },
  { section: 'support', icon: '🤝', label: 'Apoio para jogar' },
  { section: 'access', icon: '👓', label: 'Acessibilidade' },
  { section: 'controls', icon: '🎮', label: 'Controles' },
  { section: 'app', icon: '📲', label: 'Aplicativo' },
  { section: 'help', icon: '🛟', label: 'Ajuda e dados' },
];

const SUPPORT_LEVELS: Array<{ level: SupportLevel; label: string }> = [
  { level: 'assisted', label: 'Assistido' },
  { level: 'standard', label: 'Padrão' },
  { level: 'challenge', label: 'Desafio' },
];

const SUPPORT_HELP: Record<SupportLevel, string> = {
  assisted: 'Uma seta aponta a letra certa, a instrução é repetida e errar a letra não tira coração (espinhos ainda tiram).',
  standard: 'A voz diz a próxima letra; errar a letra tira um coração.',
  challenge: 'Mais letras espalhadas, inclusive vizinhas no alfabeto, e a próxima letra não é falada.',
};

/** Title, footer and gaps around a settings screen's content, in rem (panel padding excluded). */
const CHROME_REM = 8.5;

/**
 * The shared frame of every settings screen: title, content, then one footer
 * row with the page controls (if any) and the actions, so paging costs no
 * extra row when the screen is wide.
 */
function SettingsFrame({ title, className = '', children, pager, actions, onBack }: {
  title: string; className?: string; children: ReactNode; pager?: ReactNode; actions?: ReactNode; onBack: () => void;
}) {
  return (
    <div className="menu-modal-screen">
      <div className={`overlay screen settings-screen ${className}`}>
        <h2>{title}</h2>
        {children}
        <div className="screen-nav">
          {pager}
          <div className="overlay-actions">
            {actions}
            <MenuButton data-nav-id="back" onClick={onBack}>Voltar</MenuButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Six destinations in a grid when they fit (2 × 3 or 3 × 2), a list in a
 * tall portrait; with too little height, pages of three.
 */
function SettingsHub({ onOpenSection, onBack }: SettingsOptions) {
  const area = useArea();
  const box = panelBox(area, CHROME_REM);
  // Same cells as .settings-hub: 10rem columns (three at most), 3.5rem rows.
  const columns = Math.min(3, fitCount(box.width, 10 * area.rem, 0.75 * area.rem));
  const rows = fitCount(box.height, 3.5 * area.rem, 0.75 * area.rem);
  const pager = usePager({
    id: 'settings-hub',
    items: DESTINATIONS,
    getId: (entry) => entry.section,
    capacity: columns * rows >= DESTINATIONS.length ? DESTINATIONS.length : 3,
  });
  return (
    <div className="menu-modal-screen">
      <div className="overlay screen settings-screen settings-hub-screen">
        <h2>Configurações</h2>
        <ul className="settings-hub">
          {pager.items.map(({ section, icon, label }) => (
            <li key={section}>
              <MenuButton className="settings-hub-btn" data-nav-id={`settings-${section}`} onClick={() => onOpenSection(section)}>
                <span className="settings-hub-icon" aria-hidden="true">{icon}</span>{label}
              </MenuButton>
            </li>
          ))}
        </ul>
        <PaginationControls pager={pager} label="Páginas das configurações" />
        <div className="overlay-actions screen-foot">
          <MenuButton data-nav-id="back" data-autofocus="" onClick={onBack}>Voltar</MenuButton>
        </div>
      </div>
    </div>
  );
}

function VolumeControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="settings-control"><span>{label}</span><input aria-label={`Volume de ${label}`} type="range" min="0" max="1" step="0.05" value={value} onChange={(event) => onChange(Number(event.currentTarget.value))}/><output>{Math.round(value * 100)}%</output></label>;
}

function Toggle({ label, checked, onChange, describedBy }: { label: string; checked: boolean; onChange: (checked: boolean) => void; describedBy?: string }) {
  return <label className="settings-toggle"><input type="checkbox" aria-describedby={describedBy} checked={checked} onChange={(event) => onChange(event.currentTarget.checked)}/><span>{label}</span></label>;
}

function AudioSettings({ audio, onAudioChange, back }: SettingsOptions & { back: () => void }) {
  return (
    <SettingsFrame title="Som e narração" onBack={back}>
      <div className="settings-group">
        <VolumeControl label="música" value={audio.musicVolume} onChange={(v) => onAudioChange('music', v)}/>
        <VolumeControl label="efeitos" value={audio.sfxVolume} onChange={(v) => onAudioChange('sfx', v)}/>
        <VolumeControl label="voz" value={audio.voiceVolume} onChange={(v) => onAudioChange('voice', v)}/>
      </div>
    </SettingsFrame>
  );
}

function SupportSettings({ experience, onExperienceChange, back }: SettingsOptions & { back: () => void }) {
  return (
    <SettingsFrame title="Apoio para jogar" onBack={back}>
      <fieldset className="settings-choice" aria-describedby="support-help">
        <legend className="sr-only">Como ajudar durante a brincadeira</legend>
        {SUPPORT_LEVELS.map(({ level, label }) => (
          <label key={level} className="settings-radio">
            <input type="radio" name="support-level" value={level} checked={experience.supportLevel === level}
              onChange={() => onExperienceChange({ supportLevel: level })}/>
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <p id="support-help" className="settings-help settings-explain">{SUPPORT_HELP[experience.supportLevel]} Vale a partir da próxima fase.</p>
    </SettingsFrame>
  );
}

type AccessPage = 'text' | 'motion';

/** "Texto e cores" and "Movimento": side by side when there is room, else two pages. */
function AccessSettings({ experience, systemReducedMotion, onExperienceChange, back }: SettingsOptions & { back: () => void }) {
  const area = useArea();
  // Both pages stacked need about 27rem of content; beside each other, two 17rem columns.
  const room = panelBox(area, CHROME_REM);
  const both = room.height >= 25 * area.rem || (room.width >= 36 * area.rem && room.height >= 15 * area.rem);
  const pager = usePager<AccessPage>({ id: 'settings-access', items: ['text', 'motion'], getId: (page) => page, capacity: both ? 2 : 1 });
  const page = (id: AccessPage) => id === 'text' ? (
    <section key={id} className="settings-section" aria-labelledby="access-text-title">
      <h3 id="access-text-title">Texto e cores</h3>
      <div className="settings-fields">
        <Toggle label="Alto contraste" checked={experience.highContrast} onChange={(v) => onExperienceChange({ highContrast: v })}/>
        <Toggle label="Texto ampliado" checked={experience.largeText} onChange={(v) => onExperienceChange({ largeText: v })}/>
      </div>
      <label className="settings-select settings-select-inline">Cores adaptadas<select value={experience.colorVision} onChange={(e) => onExperienceChange({ colorVision: e.currentTarget.value as ColorVisionMode })}>
        <option value="default">Padrão</option><option value="deuteranopia">Verde/vermelho — deuteranopia</option><option value="protanopia">Vermelho/verde — protanopia</option><option value="tritanopia">Azul/amarelo — tritanopia</option>
      </select></label>
    </section>
  ) : (
    <section key={id} className="settings-section" aria-labelledby="access-motion-title">
      <h3 id="access-motion-title">Movimento</h3>
      <Toggle label="Reduzir movimentos e flashes" describedBy="motion-help" checked={experience.reducedMotion} onChange={(v) => onExperienceChange({ reducedMotion: v })}/>
      <p id="motion-help" className="settings-help">{systemReducedMotion
        ? 'O aparelho já pede menos movimento, então o jogo fica calmo mesmo com esta opção desligada.'
        : 'Vale também quando o aparelho pede menos movimento. Não muda a velocidade nem o pulo.'}</p>
    </section>
  );
  return (
    <SettingsFrame title="Acessibilidade" className="settings-access-screen" onBack={back}
      pager={<PaginationControls pager={pager} label="Páginas de acessibilidade" />}>
      <div className={`settings-pages${pager.capacity > 1 ? ' is-split' : ''}`}>{pager.items.map(page)}</div>
    </SettingsFrame>
  );
}

function ControlsSettings({ touch, touchVisibility, onOpenSection, onOpenPhonePairing, back }: SettingsOptions & { back: () => void }) {
  return (
    <SettingsFrame title="Controles" onBack={back}>
      {touchVisibility && (
        <label className="settings-select">Botões de toque na tela<select data-nav-id="touch-visibility" value={touchVisibility.value}
          onChange={(e) => touchVisibility.onChange(e.currentTarget.value as TouchVisibility)}>
          <option value="auto">Automático</option><option value="always">Sempre mostrar</option>
        </select></label>
      )}
      <ul className="settings-hub settings-list">
        {touch && (
          <li><MenuButton className="settings-hub-btn" data-nav-id="settings-touch" onClick={() => onOpenSection('touch')}>
            <span className="settings-hub-icon" aria-hidden="true">✋</span>Ajustar toque
          </MenuButton></li>
        )}
        {touch?.onPractice && (
          <li><MenuButton className="settings-hub-btn" data-nav-id="practice" onClick={touch.onPractice}>
            <span className="settings-hub-icon" aria-hidden="true">🎮</span>Treinar controles
          </MenuButton></li>
        )}
        <li><MenuButton className="settings-hub-btn" data-nav-id="phone-pairing" onClick={onOpenPhonePairing}>
          <span className="settings-hub-icon" aria-hidden="true">📱</span>Usar outro celular como controle
        </MenuButton></li>
      </ul>
      {!touch && <p className="settings-help">Os ajustes dos botões de toque aparecem numa tela de toque ou com "Sempre mostrar" (computador com tela de toque, tablet com teclado).</p>}
    </SettingsFrame>
  );
}

/*
 * Real sizes of the on-screen controls, in CSS px — mirror of the variables in
 * touch-controls.css. Used only to decide whether the preview fits at real
 * size; the preview itself is drawn by that same CSS.
 */
const TOUCH_SIZES: Record<TouchSize, { dir: number; jump: number; gap: number }> = {
  default: { dir: 56, jump: 68, gap: 12 },
  large: { dir: 68, jump: 80, gap: 14 },
};
const TOUCH_EDGES: Record<EdgeInset, number> = { near: 16, medium: 32, far: 48 };
/** Minimum free space kept between the D-pad and the jump button in the preview. */
const PREVIEW_MIN_SPACE = 24;

/** Width the preview needs to show `layout` at real size, borders included. */
export function touchPreviewWidth(layout: Pick<TouchLayout, 'size' | 'jumpSide' | 'edgeInset'>): number {
  const size = TOUCH_SIZES[layout.size] ?? TOUCH_SIZES.default;
  const edge = TOUCH_EDGES[layout.edgeInset] ?? TOUCH_EDGES.near;
  return 2 * size.dir + size.gap + size.jump + 2 * edge + PREVIEW_MIN_SPACE + 4;
}

/**
 * Same classes and CSS variables as the real controls, at real size, so the
 * preview shows the actual reach. Touching it lights the button up but it is
 * not wired to any input adapter: the character never moves from here. When
 * the stage is narrower than the controls need, it says so instead of
 * shrinking them (docs/22 M15).
 */
function TouchPreview({ layout }: { layout: TouchLayout }) {
  const stage = useRef<HTMLDivElement>(null);
  const area = useArea();
  const { width } = useBoxSize(stage, { width: Math.min(area.width - 3 * area.rem, 720), height: 0 });
  const [held, setHeld] = useState<ReadonlySet<string>>(new Set());
  const fits = width >= touchPreviewWidth(layout);
  const hold = (name: string, on: boolean) => (event: PointerEvent<HTMLSpanElement>) => {
    if (on) event.currentTarget.setPointerCapture?.(event.pointerId);
    setHeld((current) => {
      const next = new Set(current);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });
  };
  const button = (name: string, className: string, icon: string) => (
    <span
      className={`touch-btn ${className}${held.has(name) ? ' is-held' : ''}`}
      onPointerDown={hold(name, true)}
      onPointerUp={hold(name, false)}
      onPointerCancel={hold(name, false)}
      onLostPointerCapture={hold(name, false)}
    >{icon}</span>
  );
  return (
    <div ref={stage} className="touch-preview-stage">
      {fits ? (
        <>
          <p className="settings-help">Toque para testar o alcance. O personagem não se mexe aqui.</p>
          <div className="touch-preview" aria-hidden="true" data-touch-size={layout.size} data-jump-side={layout.jumpSide} data-touch-inset={layout.edgeInset}>
            <div className="touch-controls-dpad">{button('left', 'touch-btn-left', '◀')}{button('right', 'touch-btn-right', '▶')}</div>
            {button('jump', 'touch-btn-jump', '⤒')}
          </div>
        </>
      ) : (
        <p className="settings-help settings-explain" role="note">
          Esta tela é estreita demais para mostrar os botões no tamanho real. Gire o aparelho para ver a prévia,
          ou use “Treinar controles”: as fases são jogadas com o aparelho deitado.
        </p>
      )}
    </div>
  );
}

type TouchStep = 'form' | 'preview';

/** Form and real-size preview: side by side, stacked, or two steps when space is short. */
function TouchSettings({ touch, back }: SettingsOptions & { back: () => void }) {
  const area = useArea();
  const { layout, onChange, onReset } = touch!;
  const room = panelBox(area, CHROME_REM);
  const previewHeight = TOUCH_SIZES[layout.size].jump + 2 * TOUCH_EDGES[layout.edgeInset] + 3 * area.rem;
  // The three fields share a row from ~30rem (see .settings-fields); stacked they need about 17rem.
  const formHeight = (room.width >= 30 * area.rem ? 8.5 : 17) * area.rem;
  const beside = room.width >= 20 * area.rem + touchPreviewWidth(layout) && room.height >= Math.max(17 * area.rem, previewHeight);
  const stacked = room.height >= formHeight + previewHeight + area.rem;
  const pager = usePager<TouchStep>({ id: 'settings-touch', items: ['form', 'preview'], getId: (step) => step, capacity: beside || stacked ? 2 : 1 });
  const step = (id: TouchStep) => id === 'form' ? (
    <section key={id} className="settings-section" aria-label="Botões de toque">
      <div className="settings-fields">
      <label className="settings-select">Tamanho dos botões<select value={layout.size} onChange={(e) => onChange({ size: e.currentTarget.value as TouchSize })}>
        <option value="default">Padrão</option><option value="large">Maior</option>
      </select></label>
      <label className="settings-select">Botão de pular<select value={layout.jumpSide} onChange={(e) => onChange({ jumpSide: e.currentTarget.value as JumpSide })}>
        <option value="right">À direita</option><option value="left">À esquerda</option>
      </select></label>
      <label className="settings-select">Distância da borda<select value={layout.edgeInset} onChange={(e) => onChange({ edgeInset: e.currentTarget.value as EdgeInset })}>
        <option value="near">Perto</option><option value="medium">Média</option><option value="far">Longe</option>
      </select></label>
      </div>
      <div className="settings-section-foot">
        <p className="settings-help">Vale só neste aparelho.</p>
        {/* Restores only the touch layout, never audio or progress. */}
        <MenuButton className="btn-util" data-nav-id="touch-reset" disabled={isDefaultTouchLayout(layout)} onClick={onReset}><span aria-hidden="true">↺ </span>Restaurar controles</MenuButton>
      </div>
    </section>
  ) : (
    <section key={id} className="settings-section touch-preview-section" aria-labelledby="touch-preview-title">
      <h3 id="touch-preview-title">Prévia</h3>
      <TouchPreview layout={layout} />
    </section>
  );
  return (
    <SettingsFrame
      title="Ajustar toque"
      className="settings-touch-screen"
      onBack={back}
      pager={<PaginationControls pager={pager} label="Etapas do ajuste de toque" itemNoun="Etapa" />}
    >
      <div className={`settings-pages${pager.capacity > 1 ? (beside ? ' is-split' : ' is-stacked') : ''}`}>{pager.items.map(step)}</div>
    </SettingsFrame>
  );
}

function AppSettings({ onOpenInstallGuide, back }: SettingsOptions & { back: () => void }) {
  const { supported, fullscreen, toggle } = useFullscreen();
  const installable = usePwaInstallable();
  const standalone = isStandalone();
  return (
    <SettingsFrame title="Aplicativo" onBack={back}>
      <div className="settings-pages is-split">
        <section className="settings-section" aria-labelledby="app-install-title">
          <h3 id="app-install-title">Instalar</h3>
          <p className="settings-help" role="status">{standalone
            ? '✓ O jogo já está aberto como aplicativo.'
            : installable ? 'Este navegador pode instalar o jogo.' : 'Veja como adicionar o jogo à tela de início.'}</p>
          {!standalone && <MenuButton className="btn-util" data-nav-id="install" onClick={onOpenInstallGuide}><span aria-hidden="true">📲 </span>Instalar no celular</MenuButton>}
        </section>
        <section className="settings-section" aria-labelledby="app-fullscreen-title">
          <h3 id="app-fullscreen-title">Tela cheia</h3>
          {supported ? (
            <MenuButton className="btn-util" data-nav-id="fullscreen" aria-pressed={fullscreen} onClick={() => void toggle()}>
              <span aria-hidden="true">{fullscreen ? '🗗 ' : '⛶ '}</span>{fullscreen ? 'Sair da tela cheia' : 'Usar tela cheia'}
            </MenuButton>
          ) : (
            <p className="settings-help">Este navegador não oferece tela cheia. Instalado como aplicativo, o jogo abre sem a barra do navegador.</p>
          )}
        </section>
      </div>
    </SettingsFrame>
  );
}

function HelpSettings({ onOpenSupport, onOpenGuardianInfo, onResetProgress, back }: SettingsOptions & { back: () => void }) {
  return (
    <SettingsFrame title="Ajuda e dados" onBack={back}>
      <div className="settings-pages is-split">
        <ul className="settings-hub settings-list">
          {onOpenSupport && <li><MenuButton className="settings-hub-btn" data-nav-id="support" onClick={onOpenSupport}>
            <span className="settings-hub-icon" aria-hidden="true">ℹ️</span>Informações para suporte
          </MenuButton></li>}
          {onOpenGuardianInfo && <li><MenuButton className="settings-hub-btn" data-nav-id="guardian-info" onClick={onOpenGuardianInfo}>
            <span className="settings-hub-icon" aria-hidden="true">👪</span>Informações aos responsáveis
          </MenuButton></li>}
        </ul>
        {/* Destructive action kept apart; the confirmation starts on Cancelar. */}
        <section className="settings-section settings-danger" aria-labelledby="danger-title">
          <h3 id="danger-title">Apagar dados</h3>
          <p className="settings-help">Apaga as fases, o caderno e o recorde deste jogador neste aparelho.</p>
          <MenuButton className="btn-danger" data-nav-id="reset" onClick={onResetProgress}><span aria-hidden="true">🗑️ </span>Zerar progresso</MenuButton>
        </section>
      </div>
    </SettingsFrame>
  );
}

const SECTIONS: Record<SettingsSection, (props: SettingsOptions & { back: () => void }) => ReactNode> = {
  audio: AudioSettings,
  support: SupportSettings,
  access: AccessSettings,
  controls: ControlsSettings,
  touch: TouchSettings,
  app: AppSettings,
  help: HelpSettings,
};

/** Voltar (and the BACK action) of each screen: the hub leaves, a section goes up one level. */
export function settingsBack(options: SettingsOptions): () => void {
  const { section } = options;
  if (!section) return options.onBack;
  return () => options.onOpenSection(SETTINGS_PARENT[section]);
}

export function buildSettingsScreen(options: SettingsOptions) {
  const back = settingsBack(options);
  // "Ajustar toque" only exists where there are touch controls (hybrids are re-read by the scene).
  const section = options.section === 'touch' && !options.touch ? 'controls' : options.section;
  const Section = section ? SECTIONS[section] : null;
  return buildScreen(
    Section ? <Section {...options} back={back} /> : <SettingsHub {...options} />,
    { back },
  );
}

