import { useEffect, useState } from 'react';
import { wordImage } from '../../content/discoveries.js';
import type { WordEntry } from '../../content/word-bank.js';

type PictureState = 'loading' | 'ready' | 'unavailable';

/** Total load attempts per mounted picture: the first one plus one retry when the network returns. */
const MAX_ATTEMPTS = 2;

/**
 * A word's local illustration with a readable fallback (docs/18 §6). It keeps
 * the same box in every state, so cards and the HUD never jump: a quiet paper
 * background while loading, the picture when ready, and the word itself when
 * the file is unavailable — never a broken-image icon. The actions around it
 * (Ouvir, Jogar de novo) do not depend on the picture at all.
 *
 * A failed picture is retried at most once, only when the browser reports the
 * connection is back; renders never re-request it.
 */
export function WordPicture({ word, eager = true }: { word: WordEntry; eager?: boolean }) {
  const [state, setState] = useState<PictureState>('loading');
  const [attempt, setAttempt] = useState(1);
  const label = word.label.toLowerCase();

  useEffect(() => {
    setState('loading');
    setAttempt(1);
  }, [word.id]);

  useEffect(() => {
    if (state !== 'unavailable' || attempt >= MAX_ATTEMPTS || typeof window === 'undefined') return;
    const retry = () => {
      setAttempt((value) => value + 1);
      setState('loading');
    };
    window.addEventListener('online', retry, { once: true });
    return () => window.removeEventListener('online', retry);
  }, [state, attempt]);

  if (state === 'unavailable') {
    return (
      <span className="word-picture word-picture-fallback" role="img" aria-label={`Ilustração indisponível: ${label}`} data-state="unavailable">
        <span aria-hidden="true">{word.label}</span>
      </span>
    );
  }

  return (
    <img
      // A new attempt is a new element, so the browser really requests it again.
      key={attempt}
      className="word-picture"
      data-state={state}
      src={wordImage(word)}
      alt={`Ilustração: ${label}`}
      width="128"
      height="128"
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onLoad={() => setState('ready')}
      onError={() => setState('unavailable')}
    />
  );
}
