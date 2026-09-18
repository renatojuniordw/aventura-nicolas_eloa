/**
 * Shared debug flag for the game/TV side, toggled by Actions.DEBUG (F2, see
 * `game.debug` in main.ts). Modules that log verbose diagnostics but have no
 * access to the `game` object (e.g. PlayerController, which is constructed
 * standalone) import this instead of threading a flag through their options.
 */
export const DEBUG = { enabled: false };
