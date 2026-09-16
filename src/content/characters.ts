export interface Character {
  id: string;
  name: string;
  available: boolean;
  color: string;
  accent: string;
  emoji: string;
  portrait: string;
  sprites: Record<string, string>;
}

/**
 * Selectable characters. Data only — the player renderer reads `sprites`/
 * `color`, so adding a character is a new entry here, never a code change.
 */
export const CHARACTERS: readonly Character[] = Object.freeze([
  {
    id: 'char-nicolas',
    name: 'Nicolas Gomes',
    available: true,
    color: '#f2645f',
    accent: '#ffcc4d',
    emoji: '⭐',
    portrait: '/assets/portraits/nicolas_gomes/portrait-pixel-v1.png',
    sprites: {
      idle: '/assets/characters/nicolas_gomes/idle-pixel-v1.png',
      walk: '/assets/characters/nicolas_gomes/walk-pixel-v1.png',
      jump: '/assets/characters/nicolas_gomes/jump_cycle-pixel-v1.png',
      celebrate: '/assets/characters/nicolas_gomes/celebrate-pixel-v1.png',
    },
  },
]);

export const DEFAULT_CHARACTER_ID = CHARACTERS[0].id;

/**
 * Returns character for gameplay. If requested character is missing or has
 * no gameplay sprites yet, safely falls back to default character.
 */
export function getCharacter(id: string | undefined): Character {
  const found = CHARACTERS.find((character) => character.id === id);
  if (found && found.sprites) {
    return found;
  }
  return CHARACTERS[0];
}
