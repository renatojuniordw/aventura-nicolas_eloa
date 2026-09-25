import { getLetterReferenceWord } from '../content/letter-reference';

export interface SpeechNarratorOptions {
  isMuted?: () => boolean;
  synth?: SpeechSynthesis | null;
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: () => number;
  onSpeakingChange?: (speaking: boolean) => void;
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
  private _volume: () => number;
  private _onSpeakingChange: (speaking: boolean) => void;

  constructor({
    isMuted = () => false,
    synth = typeof window !== 'undefined' ? window.speechSynthesis ?? null : null,
    lang = 'pt-BR',
    rate = 0.92,
    pitch = 1.15,
    volume = () => 1,
    onSpeakingChange = () => {},
  }: SpeechNarratorOptions = {}) {
    this._isMuted = isMuted;
    this._synth = synth;
    this._lang = lang;
    this._rate = rate;
    this._pitch = pitch;
    this._volume = volume;
    this._onSpeakingChange = onSpeakingChange;
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
      utterance.volume = Math.min(1, Math.max(0, this._volume()));

      // Retain utterance reference to prevent browser Garbage Collection from killing TTS engine
      this._activeUtterances.add(utterance);
      this._onSpeakingChange(true);
      utterance.onend = () => {
        this._activeUtterances.delete(utterance);
        if (this._activeUtterances.size === 0) this._onSpeakingChange(false);
      };
      utterance.onerror = () => {
        this._activeUtterances.delete(utterance);
        if (this._activeUtterances.size === 0) this._onSpeakingChange(false);
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
   * Eliminates the cold "X maiúsculo" artifact by contextualizing the letter, and adds a fixed
   * example word when there is one: "Encontre a letra a de amigo".
   */
  speakLessonTarget(target: string, type: string = 'letter', options: { interrupt?: boolean } = {}): boolean {
    const clean = target.trim();
    if (!clean) return false;

    if (type === 'letter' || clean.length === 1) {
      const reference = getLetterReferenceWord(clean);
      const instruction = `Encontre a letra ${clean.toLowerCase()}`;
      return this.speak(reference ? `${instruction} de ${reference}` : instruction, options);
    }
    if (type === 'syllable') {
      return this.speak(`Encontre a sílaba ${clean.toLowerCase()}`, options);
    }
    return this.speak(`Encontre a palavra ${clean.toLowerCase()}`, options);
  }

  /** Opens an Explorar phase: "Vamos montar a palavra Gato". */
  speakWordTarget(word: string, options: { interrupt?: boolean } = {}): boolean {
    const clean = word.trim();
    if (!clean) return false;
    const lower = clean.toLowerCase();
    return this.speak(`Vamos montar a palavra ${lower.charAt(0).toUpperCase()}${lower.slice(1)}`, options);
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
      this._onSpeakingChange(false);
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
