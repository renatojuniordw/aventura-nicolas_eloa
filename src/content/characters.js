/**
 * Selectable characters. Data only — the player renderer reads `sprites`/
 * `color`, so adding a character is a new entry here, never a code change.
 */
export const CHARACTERS = Object.freeze([
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
  {
    id: 'char-luna',
    name: 'Luna',
    available: false,
    color: '#e794c4',
    accent: '#ffe1a0',
    emoji: '🌸',
    portrait: '/assets/portraits/luna/portrait-pixel-v1.png',
    sprites: null,
  },
  {
    id: 'char-lucas',
    name: 'Lucas o Engenheiro',
    available: false,
    color: '#89b69b',
    accent: '#ffe1a0',
    emoji: '🔧',
    portrait: '/assets/portraits/lucas_engenheiro/portrait-pixel-v1.png',
    sprites: null,
  },
  {
    id: 'char-samara',
    name: 'Samara',
    available: false,
    color: '#d48872',
    accent: '#ffe1a0',
    emoji: '🎨',
    portrait: '/assets/portraits/samara/portrait-pixel-v1.png',
    sprites: null,
  },
]);

export const DEFAULT_CHARACTER_ID = CHARACTERS[0].id;

/**
 * Returns character for gameplay. If requested character is missing or has
 * no gameplay sprites yet, safely falls back to default character.
 */
export function getCharacter(id) {
  const found = CHARACTERS.find((character) => character.id === id);
  if (found && found.sprites) {
    return found;
  }
  return CHARACTERS[0];
}

/** Returns raw character entry including metadata even if sprites are absent. */
export function getCharacterData(id) {
  return CHARACTERS.find((character) => character.id === id) ?? CHARACTERS[0];
}
