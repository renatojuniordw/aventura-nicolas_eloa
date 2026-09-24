export type WordCategory = 'rotina' | 'animais' | 'natureza' | 'brincadeiras';

export interface WordEntry {
  id: string;
  label: string;
  fact: string;
  category: WordCategory;
}

/**
 * Words used by the "Explorar" (hangman-style) and embedding-based selection
 * (`embedding-select.ts`). `fact` is narrated by the SpeechNarrator, so it is
 * always a short, warm sentence a small child can follow.
 */
export const WORD_BANK: WordEntry[] = [
  // brincadeiras
  { id: 'bola', label: 'BOLA', fact: 'A bola é redonda. Ela rola e quica!', category: 'brincadeiras' },
  { id: 'pipa', label: 'PIPA', fact: 'O vento ajuda a pipa a ficar no ar.', category: 'brincadeiras' },
  { id: 'tambor', label: 'TAMBOR', fact: 'O tambor produz som quando a gente bate nele.', category: 'brincadeiras' },
  { id: 'barco', label: 'BARCO', fact: 'Um barquinho pode flutuar na água.', category: 'brincadeiras' },
  { id: 'bau', label: 'BAÚ', fact: 'Um baú pode guardar os tesouros das nossas brincadeiras.', category: 'brincadeiras' },
  { id: 'patins', label: 'PATINS', fact: 'Com patins nos pés, a gente desliza pelo chão.', category: 'brincadeiras' },

  // natureza
  { id: 'flor', label: 'FLOR', fact: 'A flor precisa de água e luz para crescer.', category: 'natureza' },
  { id: 'arvore', label: 'ÁRVORE', fact: 'A árvore tem raízes, tronco e folhas.', category: 'natureza' },
  { id: 'sol', label: 'SOL', fact: 'O Sol ilumina e aquece o nosso planeta.', category: 'natureza' },
  { id: 'maca', label: 'MAÇÃ', fact: 'A maçã é uma fruta que cresce na macieira.', category: 'natureza' },
  { id: 'cenoura', label: 'CENOURA', fact: 'A parte da cenoura que comemos cresce debaixo da terra.', category: 'natureza' },
  { id: 'regador', label: 'REGADOR', fact: 'O regador ajuda a levar água até as plantas.', category: 'natureza' },
  { id: 'lua', label: 'LUA', fact: 'A Lua aparece no céu à noite e muda de formato.', category: 'natureza' },

  // animais
  { id: 'gato', label: 'GATO', fact: 'O gato tem quatro patas e faz miau!', category: 'animais' },
  { id: 'borboleta', label: 'BORBOLETA', fact: 'A borboleta usa as asas para voar.', category: 'animais' },
  { id: 'abelha', label: 'ABELHA', fact: 'A abelha visita flores e ajuda a formar frutos.', category: 'animais' },
  { id: 'joaninha', label: 'JOANINHA', fact: 'A joaninha é um inseto com seis patas.', category: 'animais' },
  { id: 'caracol', label: 'CARACOL', fact: 'O caracol leva sua concha por onde passa.', category: 'animais' },
  { id: 'passaro', label: 'PÁSSARO', fact: 'O pássaro tem penas e bico. Muitos pássaros cantam!', category: 'animais' },
  { id: 'sapo', label: 'SAPO', fact: 'O sapo começa a vida como um girino.', category: 'animais' },
  { id: 'cachorro', label: 'CACHORRO', fact: 'O cachorro é um ótimo amigo e adora brincar.', category: 'animais' },
  { id: 'passarinho', label: 'PASSARINHO', fact: 'O passarinho constrói ninhos para cuidar dos filhotes.', category: 'animais' },
  { id: 'peixe', label: 'PEIXE', fact: 'O peixe usa as nadadeiras para nadar na água.', category: 'animais' },

  // rotina
  { id: 'escova-de-dente', label: 'ESCOVA', fact: 'A escova ajuda a limpar bem os dentinhos.', category: 'rotina' },
  { id: 'banho', label: 'BANHO', fact: 'O banho deixa a gente limpinho e cheiroso.', category: 'rotina' },
  { id: 'escola', label: 'ESCOLA', fact: 'Na escola a gente aprende e faz amigos.', category: 'rotina' },
  { id: 'toalha', label: 'TOALHA', fact: 'A toalha seca a gente depois do banho.', category: 'rotina' },
  { id: 'pente', label: 'PENTE', fact: 'O pente ajuda a deixar o cabelo arrumado.', category: 'rotina' },
  { id: 'sabonete', label: 'SABONETE', fact: 'O sabonete faz espuma e ajuda a lavar as mãos.', category: 'rotina' },
  { id: 'mochila', label: 'MOCHILA', fact: 'A mochila carrega os livros e brinquedos para a escola.', category: 'rotina' },
];

export function wordsByCategory(category: WordCategory): WordEntry[] {
  return WORD_BANK.filter((entry) => entry.category === category);
}

export function getWordEntry(id: string): WordEntry | undefined {
  return WORD_BANK.find((entry) => entry.id === id);
}
