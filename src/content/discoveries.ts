export interface Discovery {
  id: string; label: string; fact: string; challenge: string; x: number; y: number; w: number; h: number;
}

export const DISCOVERIES: Discovery[] = [
  { id: 'bola', label: 'BOLA', fact: 'A bola é redonda. Ela rola e quica!', challenge: 'Qual é a primeira letra de BOLA?', x: 260, y: 352, w: 88, h: 112 },
  { id: 'flor', label: 'FLOR', fact: 'A flor precisa de água e luz para crescer.', challenge: 'Encontre outra palavra que começa com F.', x: 540, y: 352, w: 88, h: 112 },
  { id: 'arvore', label: 'ÁRVORE', fact: 'A árvore tem raízes, tronco e folhas.', challenge: 'Quantas sílabas você ouve em ÁR-VO-RE?', x: 820, y: 352, w: 88, h: 112 },
  { id: 'gato', label: 'GATO', fact: 'O gato tem quatro patas e faz miau!', challenge: 'GATO rima com PATO. Você conhece outra rima?', x: 1100, y: 352, w: 88, h: 112 },
  { id: 'borboleta', label: 'BORBOLETA', fact: 'A borboleta usa as asas para voar.', challenge: 'Procure as letras B e A em BORBOLETA.', x: 1380, y: 352, w: 100, h: 112 },
  { id: 'sol', label: 'SOL', fact: 'O Sol ilumina e aquece o nosso planeta.', challenge: 'Que palavra começa com o mesmo som de SOL?', x: 1660, y: 352, w: 88, h: 112 },
];

export const DISCOVERY_LEVEL = {
  id: 'quintal', background: 'bg:primavera-lago', worldWidth: 2048, worldHeight: 540,
  solids: [
    { x: 0, y: 464, w: 2048, h: 76 },
    { x: -32, y: -540, w: 32, h: 1080 },
    { x: 2048, y: -540, w: 32, h: 1080 },
  ],
  oneWayPlatforms: [],
};
