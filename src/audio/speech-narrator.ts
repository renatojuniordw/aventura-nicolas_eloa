export interface SpeechNarratorOptions {
  isMuted?: () => boolean;
  synth?: SpeechSynthesis | null;
  lang?: string;
  rate?: number;
  pitch?: number;
}

const PRAISES = [
  'Muito bem!',
  'Parabéns!',
  'Você conseguiu!',
  'Excelente!',
  'Isso aí!',
  'Sensacional!',
];

/**
 * Pedagogical Speech Synthesizer for early childhood reading.
 * Pronounces syllables, letters, and encouraging feedback in Portuguese (pt-BR).
 *
 * Single Responsibility: Audio voice synthesis abstraction with GC leak/freeze resilience.
 * Dependency Inversion: Accepts injected SpeechSynthesis and mute-checker.
 */
export class SpeechNarrator {
  private _isMuted: () => boolean;
  private _synth: SpeechSynthesis | null;
  private _lang: string;
  private _rate: number;
  private _pitch: number;
  private _activeUtterances = new Set<SpeechSynthesisUtterance>();

  constructor({
    isMuted = () => false,
    synth = typeof window !== 'undefined' ? window.speechSynthesis ?? null : null,
    lang = 'pt-BR',
    rate = 0.92,
    pitch = 1.15,
  }: SpeechNarratorOptions = {}) {
    this._isMuted = isMuted;
    this._synth = synth;
    this._lang = lang;
    this._rate = rate;
    this._pitch = pitch;
  }

  get isSupported(): boolean {
    return this._synth != null;
  }

  speak(text: string, { interrupt = true }: { interrupt?: boolean } = {}): boolean {
    if (!this._synth || this._isMuted() || !text.trim()) {
      return false;
    }

    try {
      // Unfreeze browser TTS engine if stuck in paused state (common in Chromium/WebKit)
      if (this._synth.paused) {
        this._synth.resume();
      }

      if (interrupt) {
        this._synth.cancel();
        this._activeUtterances.clear();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this._lang;
      utterance.rate = this._rate;
      utterance.pitch = this._pitch;

      // Retain utterance reference to prevent browser Garbage Collection from killing TTS engine
      this._activeUtterances.add(utterance);
      utterance.onend = () => {
        this._activeUtterances.delete(utterance);
      };
      utterance.onerror = () => {
        this._activeUtterances.delete(utterance);
      };

      this._synth.speak(utterance);

      if (this._synth.paused) {
        this._synth.resume();
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Speaks a lesson objective with friendly pedagogical phrasing in pt-BR.
   * Eliminates the cold "X maiúsculo" artifact by contextualizing the letter.
   */
  speakLessonTarget(target: string, type: string = 'letter'): boolean {
    const clean = target.trim();
    if (!clean) return false;

    if (type === 'letter' || clean.length === 1) {
      return this.speak(`Encontre a letra ${clean.toLowerCase()}`);
    }
    if (type === 'syllable') {
      return this.speak(`Encontre a sílaba ${clean.toLowerCase()}`);
    }
    return this.speak(`Encontre a palavra ${clean.toLowerCase()}`);
  }

  /**
   * Speaks a target syllable or letter clearly.
   * Single letters are pronounced as "Letra X" to prevent TTS reading "X maiúsculo".
   */
  speakSyllable(syllable: string): boolean {
    const clean = syllable.trim();
    if (!clean) return false;
    if (clean.length === 1) {
      return this.speak(`Letra ${clean.toLowerCase()}`);
    }
    return this.speak(clean.toUpperCase());
  }

  /** Speaks an encouraging praise when completing a word or picking correctly. */
  speakPraise(customText?: string): boolean {
    if (customText) {
      return this.speak(customText);
    }
    const praise = PRAISES[Math.floor(Math.random() * PRAISES.length)];
    return this.speak(praise);
  }

  /** Clears any scheduled or currently spoken speech. */
  stop(): void {
    try {
      this._synth?.cancel();
      this._activeUtterances.clear();
    } catch {
      // Ignored in environments where cancel fails
    }
  }
}

let defaultNarrator: SpeechNarrator | null = null;

export function getDefaultNarrator(): SpeechNarrator {
  if (!defaultNarrator) {
    defaultNarrator = new SpeechNarrator();
  }
  return defaultNarrator;
}

/** Convenience helper to pronounce friendly text in Portuguese (pt-BR). */
export function speakText(text: string): boolean {
  return getDefaultNarrator().speak(text);
}
