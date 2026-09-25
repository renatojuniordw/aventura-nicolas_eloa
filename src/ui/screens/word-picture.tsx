import { wordImage } from '../../content/discoveries.js';
import type { WordEntry } from '../../content/word-bank.js';

export function WordPicture({ word }: { word: WordEntry }) {
  return <img className="word-picture" src={wordImage(word)} alt={`Ilustração: ${word.label.toLowerCase()}`} width="128" height="128" />;
}
