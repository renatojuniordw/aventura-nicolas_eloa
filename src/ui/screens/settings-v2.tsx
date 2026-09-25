import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { useFullscreen } from '../hooks.js';
import type { ExperienceSettings, SupportLevel, ColorVisionMode } from '../../persistence/experience-settings-store.js';

export interface SettingsOptions {
  onOpenPhonePairing: () => void; onOpenInstallGuide: () => void; onResetProgress: () => void; onBack: () => void;
  audio: { musicVolume: number; sfxVolume: number; voiceVolume: number };
  experience: ExperienceSettings;
  onAudioChange: (category: 'music' | 'sfx' | 'voice', value: number) => void;
  onExperienceChange: (patch: Partial<ExperienceSettings>) => void;
}

const SUPPORT_HELP: Record<SupportLevel, string> = {
  assisted: 'Uma seta aponta a letra certa, a instrução é repetida e errar a letra não tira coração (espinhos ainda tiram).',
  standard: 'A voz diz a próxima letra; errar a letra tira um coração.',
  challenge: 'Mais letras espalhadas, inclusive vizinhas no alfabeto, e a próxima letra não é falada.',
};

function VolumeControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="settings-control"><span>{label}</span><input aria-label={`Volume de ${label}`} type="range" min="0" max="1" step="0.05" value={value} onChange={(event) => onChange(Number(event.currentTarget.value))}/><output>{Math.round(value * 100)}%</output></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="settings-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)}/><span>{label}</span></label>;
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
      <Toggle label="Reduzir movimentos e flashes" checked={options.experience.reducedMotion} onChange={(v) => options.onExperienceChange({ reducedMotion: v })}/>
      <Toggle label="Texto ampliado" checked={options.experience.largeText} onChange={(v) => options.onExperienceChange({ largeText: v })}/>
      <label className="settings-select">Cores adaptadas<select value={options.experience.colorVision} onChange={(e) => options.onExperienceChange({ colorVision: e.currentTarget.value as ColorVisionMode })}>
        <option value="default">Padrão</option><option value="deuteranopia">Verde/vermelho — deuteranopia</option><option value="protanopia">Vermelho/verde — protanopia</option><option value="tritanopia">Azul/amarelo — tritanopia</option>
      </select></label>
    </section>
    <div className="overlay-actions settings-actions">
      <MenuButton className="btn-util" onClick={options.onOpenInstallGuide}>📲 Instalar no celular</MenuButton>
      {supported && <MenuButton className="btn-util" onClick={() => void toggle()}>{fullscreen ? '🗗 Sair da tela cheia' : '⛶ Modo tela cheia'}</MenuButton>}
      <MenuButton className="btn-util" onClick={options.onOpenPhonePairing}>📱 Controle por celular</MenuButton>
      <MenuButton className="btn-util" onClick={options.onResetProgress}>🗑️ Zerar progresso</MenuButton>
      <MenuButton className="btn-retro btn-primary-gold" onClick={options.onBack}>Voltar</MenuButton>
    </div>
  </div></div>;
}

export function buildSettingsScreen(options: SettingsOptions) {
  return buildScreen(<SettingsScreen {...options}/>, { primary: options.onBack, back: options.onBack });
}
