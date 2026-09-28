import { useState, type PointerEvent } from 'react';
import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { useFullscreen } from '../hooks.js';
import type { ExperienceSettings, SupportLevel, ColorVisionMode } from '../../persistence/experience-settings-store.js';
import {
  isDefaultTouchLayout,
  type EdgeInset,
  type JumpSide,
  type TouchLayout,
  type TouchSize,
} from '../../persistence/touch-layout-store.js';

export interface TouchSettingsOptions {
  layout: TouchLayout;
  onChange: (patch: Partial<TouchLayout>) => void;
  onReset: () => void;
  /** "Experimentar controles" (docs/18 §8). */
  onPractice?: () => void;
}

export interface SettingsOptions {
  onOpenPhonePairing: () => void; onOpenInstallGuide: () => void; onResetProgress: () => void; onBack: () => void;
  audio: { musicVolume: number; sfxVolume: number; voiceVolume: number };
  experience: ExperienceSettings;
  /** The device itself asks for reduced motion (motion stays reduced whatever the toggle says). */
  systemReducedMotion?: boolean;
  onAudioChange: (category: 'music' | 'sfx' | 'voice', value: number) => void;
  onExperienceChange: (patch: Partial<ExperienceSettings>) => void;
  /** Present on touch devices only. */
  touch?: TouchSettingsOptions;
  /** "Informações para suporte" (docs/18 §10). */
  onOpenSupport?: () => void;
}

const SUPPORT_HELP: Record<SupportLevel, string> = {
  assisted: 'Uma seta aponta a letra certa, a instrução é repetida e errar a letra não tira coração (espinhos ainda tiram).',
  standard: 'A voz diz a próxima letra; errar a letra tira um coração.',
  challenge: 'Mais letras espalhadas, inclusive vizinhas no alfabeto, e a próxima letra não é falada.',
};

function VolumeControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="settings-control"><span>{label}</span><input aria-label={`Volume de ${label}`} type="range" min="0" max="1" step="0.05" value={value} onChange={(event) => onChange(Number(event.currentTarget.value))}/><output>{Math.round(value * 100)}%</output></label>;
}

function Toggle({ label, checked, onChange, describedBy }: { label: string; checked: boolean; onChange: (checked: boolean) => void; describedBy?: string }) {
  return <label className="settings-toggle"><input type="checkbox" aria-describedby={describedBy} checked={checked} onChange={(event) => onChange(event.currentTarget.checked)}/><span>{label}</span></label>;
}

/**
 * Same classes and CSS variables as the real controls, at real size, so the
 * preview shows the actual reach. Touching it lights the button up but it is
 * not wired to any input adapter: the character never moves from here.
 */
function TouchPreview({ layout }: { layout: TouchLayout }) {
  const [held, setHeld] = useState<ReadonlySet<string>>(new Set());
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
    <div className="touch-preview" aria-hidden="true" data-touch-size={layout.size} data-jump-side={layout.jumpSide} data-touch-inset={layout.edgeInset}>
      <div className="touch-controls-dpad">{button('left', 'touch-btn-left', '◀')}{button('right', 'touch-btn-right', '▶')}</div>
      {button('jump', 'touch-btn-jump', '⤒')}
    </div>
  );
}

function TouchSettings({ layout, onChange, onReset, onPractice }: TouchSettingsOptions) {
  return <section className="settings-section" aria-labelledby="touch-title"><h3 id="touch-title">Controles de toque</h3>
    <label className="settings-select">Tamanho dos botões<select value={layout.size} onChange={(e) => onChange({ size: e.currentTarget.value as TouchSize })}>
      <option value="default">Padrão</option><option value="large">Maior</option>
    </select></label>
    <label className="settings-select">Botão de pular<select value={layout.jumpSide} onChange={(e) => onChange({ jumpSide: e.currentTarget.value as JumpSide })}>
      <option value="right">À direita (setas à esquerda)</option><option value="left">À esquerda (setas à direita)</option>
    </select></label>
    <label className="settings-select">Distância da borda<select value={layout.edgeInset} onChange={(e) => onChange({ edgeInset: e.currentTarget.value as EdgeInset })}>
      <option value="near">Perto</option><option value="medium">Média</option><option value="far">Longe</option>
    </select></label>
    <p className="settings-help">Prévia: toque para testar o alcance. O personagem não se mexe aqui. Vale só neste aparelho.</p>
    <TouchPreview layout={layout} />
    <div className="overlay-actions">
      {onPractice && <MenuButton className="btn-util" onClick={onPractice}>🎮 Experimentar controles</MenuButton>}
      <MenuButton className="btn-util" disabled={isDefaultTouchLayout(layout)} onClick={onReset}>↺ Restaurar padrão</MenuButton>
    </div>
  </section>;
}

function SettingsScreen(options: SettingsOptions) {
  const { supported, fullscreen, toggle } = useFullscreen();
  return <div className="menu-modal-screen"><div className="overlay settings-screen">
    <h2>Configurações</h2>
    <section className="settings-section" aria-labelledby="audio-title"><h3 id="audio-title">Som e narração</h3>
      <VolumeControl label="música" value={options.audio.musicVolume} onChange={(v) => options.onAudioChange('music', v)}/>
      <VolumeControl label="efeitos" value={options.audio.sfxVolume} onChange={(v) => options.onAudioChange('sfx', v)}/>
      <VolumeControl label="voz" value={options.audio.voiceVolume} onChange={(v) => options.onAudioChange('voice', v)}/>
    </section>
    <section className="settings-section" aria-labelledby="support-title"><h3 id="support-title">Nível de apoio</h3>
      <label className="settings-select">Como ajudar durante a brincadeira<select aria-describedby="support-help" value={options.experience.supportLevel} onChange={(e) => options.onExperienceChange({ supportLevel: e.currentTarget.value as SupportLevel })}>
        <option value="assisted">Assistido — seta, voz e sem perder coração ao errar</option><option value="standard">Padrão — como sempre foi</option><option value="challenge">Desafio — mais letras parecidas</option>
      </select></label>
      <p id="support-help" className="settings-help">{SUPPORT_HELP[options.experience.supportLevel]} Vale a partir da próxima fase.</p>
    </section>
    <section className="settings-section" aria-labelledby="access-title"><h3 id="access-title">Acessibilidade</h3>
      <Toggle label="Alto contraste" checked={options.experience.highContrast} onChange={(v) => options.onExperienceChange({ highContrast: v })}/>
      <Toggle label="Reduzir movimentos e flashes" describedBy="motion-help" checked={options.experience.reducedMotion} onChange={(v) => options.onExperienceChange({ reducedMotion: v })}/>
      <p id="motion-help" className="settings-help">{options.systemReducedMotion
        ? 'O aparelho já pede menos movimento, então o jogo fica calmo mesmo com esta opção desligada.'
        : 'Vale também quando o aparelho pede menos movimento. Não muda a velocidade nem o pulo.'}</p>
      <Toggle label="Texto ampliado" checked={options.experience.largeText} onChange={(v) => options.onExperienceChange({ largeText: v })}/>
      <label className="settings-select">Cores adaptadas<select value={options.experience.colorVision} onChange={(e) => options.onExperienceChange({ colorVision: e.currentTarget.value as ColorVisionMode })}>
        <option value="default">Padrão</option><option value="deuteranopia">Verde/vermelho — deuteranopia</option><option value="protanopia">Vermelho/verde — protanopia</option><option value="tritanopia">Azul/amarelo — tritanopia</option>
      </select></label>
    </section>
    {options.touch && <TouchSettings {...options.touch} />}
    <div className="overlay-actions settings-actions">
      <MenuButton className="btn-util" onClick={options.onOpenInstallGuide}>📲 Instalar no celular</MenuButton>
      {supported && <MenuButton className="btn-util" data-nav-id="fullscreen" onClick={() => void toggle()}>{fullscreen ? '🗗 Sair da tela cheia' : '⛶ Modo tela cheia'}</MenuButton>}
      <MenuButton className="btn-util" onClick={options.onOpenPhonePairing}>📱 Controle por celular</MenuButton>
      {options.onOpenSupport && <MenuButton className="btn-util" onClick={options.onOpenSupport}>ℹ️ Informações para suporte</MenuButton>}
      <MenuButton className="btn-util" onClick={options.onResetProgress}>🗑️ Zerar progresso</MenuButton>
      <MenuButton className="btn-retro btn-primary-gold" data-autofocus="" onClick={options.onBack}>Voltar</MenuButton>
    </div>
  </div></div>;
}

export function buildSettingsScreen(options: SettingsOptions) {
  return buildScreen(<SettingsScreen {...options}/>, { primary: options.onBack, back: options.onBack });
}
