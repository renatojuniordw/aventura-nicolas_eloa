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
 * Single Responsibility: Audio voice synthesis abstraction.
 * Dependency Inversion: Accepts injected SpeechSynthesis and mute-checker.
 */
export class SpeechNarrator {
  private _isMuted: () => boolean;
  private _synth: SpeechSynthesis | null;
  private _lang: string;
  private _rate: number;
  private _pitch: number;

  constructor({
    isMuted = () => false,
    synth = typeof window !== 'undefined' ? window.speechSynthesis ?? null : null,
    lang = 'pt-BR',
    rate = 0.95,
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
      if (interrupt) {
        this._synth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this._lang;
      utterance.rate = this._rate;
      utterance.pitch = this._pitch;

      this._synth.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }

  /** Speaks a target syllable or letter clearly. */
  speakSyllable(syllable: string): boolean {
    const clean = syllable.trim().toUpperCase();
    if (!clean) return false;
    return this.speak(clean);
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
