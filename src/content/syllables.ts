/**
 * Reviewed syllable split of every multi-syllable word the game asks for
 * (curriculum word lessons and the Explorar word bank), used by the
 * progressive hint ("BOLA" → "BO · LA").
 *
 * Authored by hand on purpose: a split computed by a heuristic can teach a
 * wrong division (docs/20 §5 F2). A word missing here simply skips the
 * segmentation step of the hint. Keys are the exact labels, accents included
 * (VOVÔ and VOVÓ are different entries).
 */
const SYLLABLES: Readonly<Record<string, readonly string[]>> = {
  // Palavras de duas sílabas
  BOLA: ['BO', 'LA'],
  BOLO: ['BO', 'LO'],
  CASA: ['CA', 'SA'],
  DADO: ['DA', 'DO'],
  GATO: ['GA', 'TO'],
  PATO: ['PA', 'TO'],
  SAPO: ['SA', 'PO'],
  MESA: ['ME', 'SA'],
  FACA: ['FA', 'CA'],
  VACA: ['VA', 'CA'],
  RATO: ['RA', 'TO'],
  LOBO: ['LO', 'BO'],
  FOGO: ['FO', 'GO'],
  JOGO: ['JO', 'GO'],
  UVA: ['U', 'VA'],
  SOPA: ['SO', 'PA'],
  TETO: ['TE', 'TO'],
  DEDO: ['DE', 'DO'],
  VELA: ['VE', 'LA'],
  FADA: ['FA', 'DA'],
  MALA: ['MA', 'LA'],
  PIPA: ['PI', 'PA'],
  COCO: ['CO', 'CO'],
  VOVÔ: ['VO', 'VÔ'],
  VOVÓ: ['VO', 'VÓ'],
  BEBÊ: ['BE', 'BÊ'],
  MAMÃE: ['MA', 'MÃE'],
  PAPAI: ['PA', 'PAI'],
  LUA: ['LU', 'A'],
  CHUVA: ['CHU', 'VA'],

  // Palavras por tema
  GALO: ['GA', 'LO'],
  FOCA: ['FO', 'CA'],
  TATU: ['TA', 'TU'],
  PERU: ['PE', 'RU'],
  SUCO: ['SU', 'CO'],
  PERA: ['PE', 'RA'],
  CAJU: ['CA', 'JU'],
  CAFÉ: ['CA', 'FÉ'],
  CAMA: ['CA', 'MA'],
  SOFÁ: ['SO', 'FÁ'],
  COPO: ['CO', 'PO'],
  PIA: ['PI', 'A'],
  PIÃO: ['PI', 'ÃO'],
  BALÃO: ['BA', 'LÃO'],
  CORDA: ['COR', 'DA'],
  BOLHA: ['BO', 'LHA'],
  TIA: ['TI', 'A'],
  TIO: ['TI', 'O'],
  NENÊ: ['NE', 'NÊ'],
  IRMÃ: ['IR', 'MÃ'],

  // Explorar
  TAMBOR: ['TAM', 'BOR'],
  BARCO: ['BAR', 'CO'],
  BAÚ: ['BA', 'Ú'],
  PATINS: ['PA', 'TINS'],
  ÁRVORE: ['ÁR', 'VO', 'RE'],
  MAÇÃ: ['MA', 'ÇÃ'],
  CENOURA: ['CE', 'NOU', 'RA'],
  REGADOR: ['RE', 'GA', 'DOR'],
  BORBOLETA: ['BOR', 'BO', 'LE', 'TA'],
  ABELHA: ['A', 'BE', 'LHA'],
  JOANINHA: ['JO', 'A', 'NI', 'NHA'],
  CARACOL: ['CA', 'RA', 'COL'],
  PÁSSARO: ['PÁS', 'SA', 'RO'],
  CACHORRO: ['CA', 'CHOR', 'RO'],
  PASSARINHO: ['PAS', 'SA', 'RI', 'NHO'],
  PEIXE: ['PEI', 'XE'],
  ESCOVA: ['ES', 'CO', 'VA'],
  BANHO: ['BA', 'NHO'],
  ESCOLA: ['ES', 'CO', 'LA'],
  TOALHA: ['TO', 'A', 'LHA'],
  PENTE: ['PEN', 'TE'],
  SABONETE: ['SA', 'BO', 'NE', 'TE'],
  MOCHILA: ['MO', 'CHI', 'LA'],
};

/** Reviewed syllables of `word`, or null when it has no reviewed split (or only one syllable). */
export function syllablesOf(word: string | null | undefined): readonly string[] | null {
  const parts = word ? SYLLABLES[word.trim().toUpperCase()] : undefined;
  return parts && parts.length > 1 ? parts : null;
}

/** "BO · LA": the visible segmentation shown by the hint. */
export function formatSyllables(parts: readonly string[]): string {
  return parts.join(' · ');
}

/** Every reviewed word (for content tests). */
export const REVIEWED_SYLLABLE_WORDS: readonly string[] = Object.keys(SYLLABLES);
