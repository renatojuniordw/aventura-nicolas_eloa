import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { WordPicture } from './word-picture.js';
import type { WordEntry } from '../../content/word-bank.js';

interface DiscoveriesOptions {
  playerName: string;
  words: Array<{ word: WordEntry; completed: boolean }>;
  onListen: (word: WordEntry) => void;
  onReplay: (word: WordEntry) => void;
  onExplore: () => void;
  onBack: () => void;
}

export function buildDiscoveriesScreen(options: DiscoveriesOptions) {
  const { playerName, words, onListen, onReplay, onExplore, onBack } = options;
  return buildScreen(<div className="overlay discoveries-screen">
    <h1>Caderno de descobertas</h1>
    <p>As palavras de {playerName}</p>
    <MenuButton onClick={onBack}>Voltar ao menu</MenuButton>
    {words.length === 0 ? <div className="discoveries-empty">
      <p>Seu caderno está esperando a primeira palavra!</p>
      <MenuButton className="primary" onClick={onExplore}>Explorar e descobrir</MenuButton>
    </div> : <ul className="discoveries-grid">{words.map(({ word, completed }) =>
      <li className="discovery-card" key={word.id}>
        <WordPicture word={word} />
        <h2>{word.label}</h2>
        <p>{completed ? 'Palavra montada' : 'Palavra visitada'}</p>
        <p>{word.fact}</p>
        <div className="overlay-actions">
          <MenuButton aria-label={`Ouvir ${word.label}`} onClick={() => onListen(word)}>♫ Ouvir</MenuButton>
          <MenuButton aria-label={`Jogar ${word.label} novamente`} onClick={() => onReplay(word)}>Jogar de novo</MenuButton>
        </div>
      </li>)}</ul>}
  </div>, { primary: words.length ? onBack : onExplore, back: onBack });
}
