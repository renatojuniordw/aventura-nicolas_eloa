// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeechNarrator, speakText } from './speech-narrator.js';

describe('SpeechNarrator', () => {
  let mockSynth;

  beforeEach(() => {
    mockSynth = {
      speak: vi.fn(),
      cancel: vi.fn(),
    };

    globalThis.SpeechSynthesisUtterance = class MockSpeechSynthesisUtterance {
      constructor(text) {
        this.text = text;
        this.lang = '';
        this.rate = 1;
        this.pitch = 1;
      }
    };
  });

  it('detects support accurately', () => {
    const supported = new SpeechNarrator({ synth: mockSynth });
    expect(supported.isSupported).toBe(true);

    const unsupported = new SpeechNarrator({ synth: null });
    expect(unsupported.isSupported).toBe(false);
  });

  it('speaks syllable with Portuguese locale settings', () => {
    const narrator = new SpeechNarrator({ synth: mockSynth });
    const result = narrator.speakSyllable('ba');

    expect(result).toBe(true);
    expect(mockSynth.cancel).toHaveBeenCalledTimes(1);
    expect(mockSynth.speak).toHaveBeenCalledTimes(1);

    const utterance = mockSynth.speak.mock.calls[0][0];
    expect(utterance.text).toBe('BA');
    expect(utterance.lang).toBe('pt-BR');
    expect(utterance.pitch).toBeGreaterThan(1);
  });

  it('announces an Explorar word with a capitalised, spoken-friendly phrase', () => {
    const narrator = new SpeechNarrator({ synth: mockSynth });
    expect(narrator.speakWordTarget('GATO')).toBe(true);
    expect(mockSynth.speak.mock.calls[0][0].text).toBe('Vamos montar a palavra Gato');
    expect(narrator.speakWordTarget('  ')).toBe(false);
  });

  it('respects isMuted when muted is true', () => {
    const narrator = new SpeechNarrator({
      synth: mockSynth,
      isMuted: () => true,
    });

    const result = narrator.speakSyllable('BE');
    expect(result).toBe(false);
    expect(mockSynth.speak).not.toHaveBeenCalled();
  });

  it('speaks praise with random or custom message', () => {
    const narrator = new SpeechNarrator({ synth: mockSynth });
    narrator.speakPraise('Muito bem, Nicolas!');

    expect(mockSynth.speak).toHaveBeenCalledTimes(1);
    const utterance = mockSynth.speak.mock.calls[0][0];
    expect(utterance.text).toBe('Muito bem, Nicolas!');
  });

  it('stops ongoing speech on stop()', () => {
    const narrator = new SpeechNarrator({ synth: mockSynth });
    narrator.stop();
    expect(mockSynth.cancel).toHaveBeenCalledTimes(1);
  });

  it('speaks lesson target for letters, syllables, and words without maiusculo artifact', () => {
    const narrator = new SpeechNarrator({ synth: mockSynth });

    narrator.speakLessonTarget('A', 'letter');
    let utterance = mockSynth.speak.mock.calls[0][0];
    expect(utterance.text).toBe('Encontre a letra a de amigo');

    narrator.speakLessonTarget('BA', 'syllable');
    utterance = mockSynth.speak.mock.calls[1][0];
    expect(utterance.text).toBe('Encontre a sílaba ba');

    narrator.speakLessonTarget('BOLA', 'word');
    utterance = mockSynth.speak.mock.calls[2][0];
    expect(utterance.text).toBe('Encontre a palavra bola');
  });

  it('adds the fixed reference word to every letter instruction in a single utterance', () => {
    const narrator = new SpeechNarrator({ synth: mockSynth });

    expect(narrator.speakLessonTarget('b', 'letter')).toBe(true);
    expect(narrator.speakLessonTarget(' Z ')).toBe(true);
    expect(narrator.speakLessonTarget('A', 'letter')).toBe(true);

    expect(mockSynth.speak.mock.calls.map(([u]) => u.text)).toEqual([
      'Encontre a letra b de bola',
      'Encontre a letra z de zebra',
      'Encontre a letra a de amigo',
    ]);
  });

  it('keeps the plain letter instruction when there is no reference word', () => {
    const narrator = new SpeechNarrator({ synth: mockSynth });

    narrator.speakLessonTarget('Á', 'letter');
    narrator.speakLessonTarget('BA', 'letter');
    narrator.speakLessonTarget('?');

    const texts = mockSynth.speak.mock.calls.map(([u]) => u.text);
    expect(texts).toEqual(['Encontre a letra á', 'Encontre a letra ba', 'Encontre a letra ?']);
    for (const text of texts) {
      expect(text).not.toContain('undefined');
      expect(text).not.toMatch(/ de\s*$/);
    }
  });

  it('does not speak an empty lesson target', () => {
    const narrator = new SpeechNarrator({ synth: mockSynth });
    expect(narrator.speakLessonTarget('  ', 'letter')).toBe(false);
    expect(mockSynth.speak).not.toHaveBeenCalled();
  });

  it('queues a letter instruction without cancelling when interrupt is false', () => {
    const narrator = new SpeechNarrator({ synth: mockSynth });

    narrator.speakLessonTarget('C', 'letter', { interrupt: false });
    expect(mockSynth.cancel).not.toHaveBeenCalled();

    narrator.speakLessonTarget('D', 'letter');
    expect(mockSynth.cancel).toHaveBeenCalledTimes(1);
    expect(mockSynth.speak).toHaveBeenCalledTimes(2);
    expect(mockSynth.speak.mock.calls[0][0].text).toBe('Encontre a letra c de casa');
  });

  it('does not speak a letter instruction when muted or unsupported', () => {
    const muted = new SpeechNarrator({ synth: mockSynth, isMuted: () => true });
    expect(muted.speakLessonTarget('A', 'letter')).toBe(false);
    expect(mockSynth.speak).not.toHaveBeenCalled();

    const unsupported = new SpeechNarrator({ synth: null });
    expect(unsupported.speakLessonTarget('A', 'letter')).toBe(false);
  });

  it('speaks text via speakText convenience helper', () => {
    window.speechSynthesis = mockSynth;
    const result = speakText('Nicolas');
    expect(typeof result).toBe('boolean');
  });
});
