/**
 * The single answer to "should decorative motion be reduced right now?"
 * (docs/18 §4): reduced when the system asks for it OR the game's own
 * "Reduzir movimentos e flashes" option is on. Canvas effects, the menu
 * celebration and any other consumer read this instead of querying
 * `prefers-reduced-motion` themselves, so both sources always agree.
 *
 * The CSS side follows the same rule through two selectors: the system media
 * query and `html[data-motion="reduced"]` (written by ExperienceSettingsStore).
 */
export interface MotionPolicy {
  reduced(): boolean;
  /** Called with the new value whenever either source changes; returns an unsubscribe. */
  subscribe(listener: (reduced: boolean) => void): () => void;
}

interface MediaQueryLike {
  readonly matches: boolean;
  addEventListener?(type: 'change', listener: () => void): void;
  removeEventListener?(type: 'change', listener: () => void): void;
}

interface MotionPolicyOptions {
  /** `(prefers-reduced-motion: reduce)`, or null where matchMedia is unavailable. */
  system?: MediaQueryLike | null;
  /** The game's own option, read live. */
  game: () => boolean;
  /** Subscribes to changes of the game option; returns an unsubscribe. */
  onGameChange?: (listener: () => void) => () => void;
}

export function createMotionPolicy({ system = null, game, onGameChange }: MotionPolicyOptions): MotionPolicy {
  const reduced = () => Boolean(system?.matches || game());
  return {
    reduced,
    subscribe(listener) {
      let last = reduced();
      const notify = () => {
        const next = reduced();
        if (next === last) return;
        last = next;
        listener(next);
      };
      system?.addEventListener?.('change', notify);
      const offGame = onGameChange?.(notify);
      return () => {
        system?.removeEventListener?.('change', notify);
        offGame?.();
      };
    },
  };
}

/** Policy that follows only the system preference (tests, standalone helpers). */
export function systemMotionPolicy(): MotionPolicy {
  const system = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null : null;
  return createMotionPolicy({ system, game: () => false });
}
