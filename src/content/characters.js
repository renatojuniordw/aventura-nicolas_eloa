/**
 * Selectable characters. Data only — the player renderer reads `sprites`/
 * `color`, so adding a character is a new entry here, never a code change.
 */
export const CHARACTERS = Object.freeze([
  {
    id: 'char-nicolas',
    name: 'Nicolas Gomes',
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

export function getCharacter(id) {
  return CHARACTERS.find((character) => character.id === id) ?? CHARACTERS[0];
}
