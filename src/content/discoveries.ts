export interface Discovery {
  id: string; label: string; icon: string; fact: string; x: number; y: number; w: number; h: number;
}

export const DISCOVERIES: Discovery[] = [
  { id: 'bola', label: 'BOLA', icon: '⚽', fact: 'A bola é redonda. Ela rola e quica!', x: 260, y: 352, w: 88, h: 112 },
  { id: 'flor', label: 'FLOR', icon: '🌻', fact: 'A flor precisa de água e luz para crescer.', x: 540, y: 352, w: 88, h: 112 },
  { id: 'arvore', label: 'ÁRVORE', icon: '🌳', fact: 'A árvore tem raízes, tronco e folhas.', x: 820, y: 352, w: 88, h: 112 },
  { id: 'gato', label: 'GATO', icon: '🐈', fact: 'O gato tem quatro patas e faz miau!', x: 1100, y: 352, w: 88, h: 112 },
  { id: 'borboleta', label: 'BORBOLETA', icon: '🦋', fact: 'A borboleta usa as asas para voar.', x: 1380, y: 352, w: 100, h: 112 },
  { id: 'sol', label: 'SOL', icon: '☀️', fact: 'O Sol ilumina e aquece o nosso planeta.', x: 1660, y: 352, w: 88, h: 112 },
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
