import { mountScreen, blurOnClick } from './mount-screen.js';
import { CHARACTERS, type Character } from '../../content/characters.js';

interface CharacterPickerOptions {
  selectedId: string | null;
  onSelect: (characterId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

function CharacterCard({
  character,
  selected,
  onSelect,
}: {
  character: Character;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      className={`companion-card character-picker-card ${selected ? 'selected' : ''}`}
      type="button"
      tabIndex={-1}
      aria-pressed={selected}
      onClick={blurOnClick(() => onSelect(character.id))}
    >
      {selected ? <div className="character-picker-tag">1P Ativo</div> : null}
      {character.portrait ? (
        <div className="character-picker-frame">
          <img className="companion-avatar character-picker-thumb" src={character.portrait} alt={character.name} />
        </div>
      ) : (
        <span className="companion-swatch" style={{ background: character.color }} />
      )}
      <div className="character-picker-info">
        <span className="companion-name character-picker-name">{character.name}</span>
        <span className="character-picker-status">{selected ? '✓ Selecionado' : 'Toque para escolher'}</span>
      </div>
    </button>
  );
}

function CharacterPickerScreen({ selectedId, onSelect, onConfirm, onBack }: CharacterPickerOptions) {
  return (
    <div className="overlay character-picker-overlay">
      <h2>Escolha seu Personagem</h2>
      <p className="character-picker-subtitle">
        Selecione quem vai pular, descobrir e brincar com você nesta aventura!
      </p>
      <div className="character-grid character-picker-grid">
        {CHARACTERS.map((character) => (
          <CharacterCard
            key={character.id}
            character={character}
            selected={character.id === selectedId}
            onSelect={onSelect}
          />
        ))}
        <div className="companion-card character-picker-card placeholder" aria-disabled="true">
          <div className="character-picker-frame placeholder">
            <span className="character-picker-placeholder-icon">🎀</span>
          </div>
          <div className="character-picker-info">
            <span className="character-picker-name">Eloá</span>
            <span className="character-picker-status locked">Em breve</span>
          </div>
        </div>
      </div>
      <div className="overlay-actions character-picker-actions">
        <button type="button" tabIndex={-1} className="btn-retro btn-primary-gold" onClick={blurOnClick(onConfirm)}>
          Confirmar Escolha
        </button>
        <button type="button" tabIndex={-1} className="btn-util" onClick={blurOnClick(onBack)}>
          Voltar ao Menu
        </button>
      </div>
    </div>
  );
}

export function buildCharacterPickerScreen(options: CharacterPickerOptions) {
  const { node, cleanup } = mountScreen(<CharacterPickerScreen {...options} />);
  return { node, primary: options.onConfirm, back: options.onBack, cleanup };
}
