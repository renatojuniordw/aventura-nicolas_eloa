import type { CanvasRenderer } from './canvas-renderer.js';

const palette: Record<string, string> = {
  G: '#55a866', g: '#326855', Y: '#ffd447', O: '#efaa58', R: '#e55b45',
  B: '#426b9b', W: '#fff7df', K: '#263d51', P: '#ef77a8', T: '#986132',
};

// Small pixel drawings keep new discoveries consistent with the original art.
const sprites: Record<string, string[]> = {
  abelha: ['..WW.WW...', '..WW.WW...', '.YYYKYYY..', 'YYYKYKYKY.', '.YYYKYYYK.', '...K.K....'],
  joaninha: ['...KKK....', '..RRRRR...', '.RKRKRKR..', '.RRRKRRR..', '.RKRKRKR..', '..K.K.K...'],
  caracol: ['...OOOO...', '..OTTTO...', '..OTOTO...', '..OTTTO.KK', 'GGGOOOOGGG', '.GGGGGGGG.'],
  passaro: ['.....BBB..', '....BWKBY.', '..BBBBBB..', '.BBBWBBB..', 'BB.BBBB...', '....T.T...'],
  maca: ['.....TG...', '....TGG...', '..RR.RRR..', '.RRRWRRRR.', '.RRRRRRRR.', '..RRRRRR..', '...RRRR...'],
  cenoura: ['..G.G.G...', '...GGG....', '..OOOOO...', '..OOTOO...', '...OOO....', '...TOO....', '....O.....'],
  regador: ['...GGGG...', '..G....G..', '..GGGGGG..', '..GBBBBG.G', '..GBBBBGG.', '..GGGGGG..', '.......BB.'],
  sapo: ['..GW..WG..', '..GK..KG..', '.GGGGGGGG.', '.GGKGGKGG.', '..GGKKGG..', 'GGGG..GGGG'],
  pipa: ['....B.....', '...BBB....', '..BBBRR...', '.BBBBRRR..', '..YYRRR...', '...YYR....', '....T.....', '...PT.....', '....TP....'],
  tambor: ['..YYYYYY..', '.YYYYYYYY.', '.RWRRRWRR.', '.RRWRWRRR.', '.RRRWRRRR.', '.YYYYYYYY.', '..T....T..'],
  barco: ['....T.....', '....TW....', '....TWW...', '....TWWW..', '....T.....', '.TTTTTTTT.', '..TTTTTT..', 'BBBBBBBBBB'],
  bau: ['..TTTTTT..', '.TYYYYYYT.', '.TYTTTTYT.', '.TYYYKYYT.', '.TTTTKTTT.', '.TYYYYYYT.', '.TTTTTTTT.'],
};

export function drawDiscoveryPixels(renderer: CanvasRenderer, id: string, x: number, y: number, wave: number): boolean {
  const sprite = sprites[id];
  if (!sprite) return false;
  sprite.forEach((row, iy) => {
    [...row].forEach((pixel, ix) => {
      if (palette[pixel]) renderer.worldFillRect(x + 8 + ix * 6, y + iy * 6 - Math.abs(wave) * 7, 6, 6, palette[pixel]);
    });
  });
  return true;
}
