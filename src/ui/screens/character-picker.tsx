import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { CHARACTERS, type Character } from '../../content/characters.js';
import { speakText } from '../../audio/speech-narrator.js';
import { vibrateTap, vibrateSuccess } from '../../input/haptics.js';

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
  const handleClick = () => {
    vibrateTap();
    const firstName = character.name.split(' ')[0];
    speakText(firstName);
    onSelect(character.id);
  };

  return (
    <MenuButton
      className={`companion-card character-picker-card ${selected ? 'selected' : ''}`}

      aria-pressed={selected}
      onClick={handleClick}
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
    </MenuButton>
  );
}

function CharacterPickerScreen({ selectedId, onSelect, onConfirm, onBack }: CharacterPickerOptions) {
  return (
    <div className="character-picker-screen">
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
        </div>
        <div className="overlay-actions character-picker-actions">
          <MenuButton

            className="btn-retro btn-primary-gold"
            onClick={() => {
              vibrateSuccess();
              onConfirm();
            }}
          >
            Confirmar Escolha
          </MenuButton>
          <MenuButton className="btn-util" onClick={onBack}>
            Voltar ao Menu
          </MenuButton>
        </div>
      </div>
    </div>
  );
}

export function buildCharacterPickerScreen(options: CharacterPickerOptions) {
  return buildScreen(<CharacterPickerScreen {...options} />, { primary: options.onConfirm, back: options.onBack });
}
