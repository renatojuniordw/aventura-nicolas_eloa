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


DISCOVERIES.push(
  { id: 'abelha', label: 'ABELHA', fact: 'A abelha visita flores e ajuda a formar frutos.', challenge: 'Bata palmas para as sílabas: A-BE-LHA.', x: 0, y: 352, w: 88, h: 112 },
  { id: 'joaninha', label: 'JOANINHA', fact: 'A joaninha é um inseto com seis patas.', challenge: 'Conte até seis usando os dedos.', x: 0, y: 352, w: 88, h: 112 },
  { id: 'caracol', label: 'CARACOL', fact: 'O caracol leva sua concha por onde passa.', challenge: 'Caminhe bem devagar como um caracol.', x: 0, y: 352, w: 88, h: 112 },
  { id: 'passaro', label: 'PÁSSARO', fact: 'O pássaro tem penas e bico. Muitos pássaros cantam!', challenge: 'Imite o canto de um passarinho.', x: 0, y: 352, w: 88, h: 112 },
  { id: 'maca', label: 'MAÇÃ', fact: 'A maçã é uma fruta que cresce na macieira.', challenge: 'Qual outra fruta você conhece?', x: 0, y: 352, w: 88, h: 112 },
  { id: 'cenoura', label: 'CENOURA', fact: 'A parte da cenoura que comemos cresce debaixo da terra.', challenge: 'Que cor tem esta cenoura?', x: 0, y: 352, w: 88, h: 112 },
  { id: 'regador', label: 'REGADOR', fact: 'O regador ajuda a levar água até as plantas.', challenge: 'Faça de conta que está regando uma flor.', x: 0, y: 352, w: 88, h: 112 },
  { id: 'sapo', label: 'SAPO', fact: 'O sapo começa a vida como um girino.', challenge: 'Pule três vezes como um sapo.', x: 0, y: 352, w: 88, h: 112 },
  { id: 'pipa', label: 'PIPA', fact: 'O vento ajuda a pipa a ficar no ar.', challenge: 'Encontre a letra P em PIPA.', x: 0, y: 352, w: 88, h: 112 },
  { id: 'tambor', label: 'TAMBOR', fact: 'O tambor produz som quando a gente bate nele.', challenge: 'Bata duas palmas e faça uma pausa.', x: 0, y: 352, w: 88, h: 112 },
  { id: 'barco', label: 'BARCO', fact: 'Um barquinho pode flutuar na água.', challenge: 'BARCO começa com a mesma letra de BOLA?', x: 0, y: 352, w: 88, h: 112 },
  { id: 'bau', label: 'BAÚ', fact: 'Um baú pode guardar os tesouros das nossas brincadeiras.', challenge: 'Qual foi sua descoberta favorita?', x: 0, y: 352, w: 88, h: 112 },
);

export const DISCOVERY_AREAS = [
  { label: 'Jardim dos bichinhos', x: 0, color: '#397f4e', ids: ['flor', 'borboleta', 'abelha', 'joaninha', 'caracol', 'sapo'] },
  { label: 'Pomar e horta', x: 1600, color: '#986132', ids: ['arvore', 'passaro', 'maca', 'cenoura', 'regador', 'sol'] },
  { label: 'Cantinho das brincadeiras', x: 3200, color: '#426b9b', ids: ['bola', 'gato', 'pipa', 'tambor', 'barco', 'bau'] },
];

// Each area has a short raised path; the continuous lawn remains safe to explore.
for (const area of DISCOVERY_AREAS) {
  area.ids.forEach((id, index) => {
    const item = DISCOVERIES.find((discovery) => discovery.id === id)!;
    item.x = area.x + 200 + index * 240;
    item.y = index === 2 || index === 3 ? 240 : 352;
  });
}
DISCOVERIES.sort((a, b) => a.x - b.x);

export const DISCOVERY_LEVEL = {
  id: 'quintal', background: 'bg:primavera-lago', worldWidth: 4800, worldHeight: 540,
  solids: [
    { x: 0, y: 464, w: 4800, h: 76 },
    { x: -32, y: -540, w: 32, h: 1080 },
    { x: 4800, y: -540, w: 32, h: 1080 },
  ],
  oneWayPlatforms: DISCOVERY_AREAS.flatMap((area) => [
    { x: area.x + 530, y: 408, w: 100, h: 16 },
    { x: area.x + 650, y: 352, w: 390, h: 18 },
    { x: area.x + 1060, y: 408, w: 100, h: 16 },
  ]),
};
