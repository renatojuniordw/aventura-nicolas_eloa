/**
 * Semantic actions the game understands.
 *
 * This is the vocabulary shared by every input source. It deliberately contains
 * NO key names and NO hardware details: the keyboard adapter, and a future
 * ESP32 adapter, both speak in terms of these ids. Gameplay logic is expressed
 * against actions, so swapping the physical input never touches the game.
 */

export const Actions = Object.freeze({
  /** Held while pressed; moves the character left. */
  MOVE_LEFT: 'moveLeft',
  /** Held while pressed; moves the character right. */
  MOVE_RIGHT: 'moveRight',
  /** Edge-triggered; asks the character to jump (the decision lives in the controller). */
  JUMP: 'jump',
  /** Edge-triggered; toggles pause. */
  PAUSE: 'pause',
  /** Edge-triggered; confirms a menu choice. */
  CONFIRM: 'confirm',
  /** Edge-triggered; goes back / cancels. */
  BACK: 'back',
  /** Edge-triggered; toggles the debug overlay (hitboxes). */
  DEBUG: 'debug',
  /** Reserved for a future ability. Wired now, does nothing in v1. */
  POWER_1: 'power1',
  /** Reserved for a future ability. Wired now, does nothing in v1. */
  POWER_2: 'power2',
});

export type ActionId = (typeof Actions)[keyof typeof Actions];

/**
 * Every action is tracked both as "held" (while the key is down) and as a
 * one-shot "pressed" edge. Consumers choose which view they need:
 * movement reads `isActionHeld`, jump reads `consumePressed` for the impulse
 * and `isActionHeld` to decide whether to keep rising.
 */

/** pt-BR labels used in menus and the controls help panel. */
export const ACTION_LABELS = Object.freeze({
  [Actions.MOVE_LEFT]: 'Andar para a esquerda',
  [Actions.MOVE_RIGHT]: 'Andar para a direita',
  [Actions.JUMP]: 'Pular',
  [Actions.PAUSE]: 'Pausar',
  [Actions.CONFIRM]: 'Confirmar',
  [Actions.BACK]: 'Voltar',
  [Actions.DEBUG]: 'Mostrar hitboxes',
  [Actions.POWER_1]: 'Poder 1',
  [Actions.POWER_2]: 'Poder 2',
});
