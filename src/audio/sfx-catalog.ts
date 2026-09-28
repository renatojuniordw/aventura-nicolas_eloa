/**
 * Semantic effect keys and the files behind them. Scenes play by key only, so
 * swapping a sound is a one-line change here. Files live under
 * public/assets/audio/sfx/ and are served from /assets/audio/sfx/; origin and
 * license of each one are recorded in THIRD_PARTY_NOTICES.md.
 */
export const Sfx = {
  ANSWER_SUCCESS: 'answer-success',
  ANSWER_ERROR: 'answer-error',
} as const;

export type SfxKey = (typeof Sfx)[keyof typeof Sfx];

/**
 * Gains are relative to the "efeitos" slider. Both effects sit below full
 * volume so the praise/instruction spoken right after stays intelligible, and
 * the error is the softer one: a wrong answer is a hint, not a punishment.
 * Starting values — tune after listening on the target devices (docs/21 §3.2).
 */
export const SFX_CATALOG: ReadonlyArray<{ key: SfxKey; url: string; gain: number }> = [
  { key: Sfx.ANSWER_SUCCESS, url: '/assets/audio/sfx/answer_success.wav', gain: 0.7 },
  { key: Sfx.ANSWER_ERROR, url: '/assets/audio/sfx/answer_error.wav', gain: 0.55 },
];

export function registerSfxCatalog(audio: { register(key: string, url: string, options?: { gain?: number }): void }): void {
  for (const { key, url, gain } of SFX_CATALOG) audio.register(key, url, { gain });
}
