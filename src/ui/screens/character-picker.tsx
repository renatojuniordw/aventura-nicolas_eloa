import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { CHARACTERS, type Character } from '../../content/characters.js';
import { speakText } from '../../audio/speech-narrator.js';
import { vibrateTap, vibrateSuccess } from '../../input/haptics.js';
import { gridCapacity, PaginationControls, useArea, usePager } from './layout.js';

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
      data-nav-id={`character-${character.id}`}
      onClick={handleClick}
    >
      {selected ? <div className="character-picker-tag" aria-hidden="true">Ativo</div> : null}
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

/** Card width and height in rem, for how many characters fit side by side. */
const CARD_REM = { width: 8.5, height: 9 };

function CharacterPickerScreen({ selectedId, onSelect, onConfirm, onBack }: CharacterPickerOptions) {
  const area = useArea();
  // Two compact cards side by side; more characters later go to other pages, never smaller cards.
  const pager = usePager({
    id: 'characters',
    items: CHARACTERS,
    getId: (character) => character.id,
    capacity: gridCapacity({ width: Math.min(area.width, 560) - 3 * area.rem, height: area.height - 10 * area.rem }, area.rem, { ...CARD_REM, maxColumns: 4 }),
    start: selectedId,
  });
  return (
    <div className="character-picker-screen">
      <div className="overlay screen character-picker-overlay">
        <h2>Escolha seu personagem</h2>
        <p className="character-picker-subtitle">Quem vai brincar com você?</p>
        <div className="character-grid character-picker-grid">
          {pager.items.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              selected={character.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
        <PaginationControls pager={pager} label="Páginas de personagens" itemNoun="Personagem" />
        <div className="overlay-actions character-picker-actions">
          <MenuButton
            className="btn-retro btn-primary-gold" data-autofocus=""
            onClick={() => {
              vibrateSuccess();
              onConfirm();
            }}
          >
            Confirmar escolha
          </MenuButton>
          <MenuButton data-nav-id="back" onClick={onBack}>
            Voltar ao menu
          </MenuButton>
        </div>
      </div>
    </div>
  );
}

export function buildCharacterPickerScreen(options: CharacterPickerOptions) {
  return buildScreen(<CharacterPickerScreen {...options} />, { primary: options.onConfirm, back: options.onBack });
}
