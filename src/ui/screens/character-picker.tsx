import { mountScreen, blurOnClick } from './mount-screen.js';
import { CHARACTERS, type Character } from '../../content/characters.js';

interface CharacterPickerOptions {
  selectedId: string | null;
  onSelect: (characterId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

function CharacterCard({ character, selected, onSelect }: { character: Character; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      className="companion-card"
      type="button"
      tabIndex={-1}
      aria-pressed={selected}
      onClick={blurOnClick(() => onSelect(character.id))}
    >
      {character.portrait ? (
        <img className="companion-avatar" src={character.portrait} alt={character.name} />
      ) : (
        <span className="companion-swatch" style={{ background: character.color }} />
      )}
      <span className="companion-name">{character.name}</span>
    </button>
  );
}

function CharacterPickerScreen({ selectedId, onSelect, onConfirm, onBack }: CharacterPickerOptions) {
  return (
    <div className="overlay">
      <h2>Escolha seu personagem</h2>
      <div className="character-grid">
        {CHARACTERS.map((character) => (
          <CharacterCard
            key={character.id}
            character={character}
            selected={character.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div className="overlay-actions">
        <button type="button" tabIndex={-1} className="primary" onClick={blurOnClick(onConfirm)}>
          Pronto
        </button>
        <button type="button" tabIndex={-1} onClick={blurOnClick(onBack)}>
          Voltar
        </button>
      </div>
    </div>
  );
}

export function buildCharacterPickerScreen(options: CharacterPickerOptions) {
  const { node, cleanup } = mountScreen(<CharacterPickerScreen {...options} />);
  return { node, primary: options.onConfirm, back: options.onBack, cleanup };
}
