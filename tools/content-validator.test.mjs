import { describe, expect, it } from 'vitest';
import { countSyllables, validateProposals } from './content-validator.js';

describe('countSyllables', () => {
  it.each([
    ['SOL', 1],
    ['PÃO', 1],
    ['MÃE', 1],
    ['PAI', 1],
    ['BOLA', 2],
    ['VOVÔ', 2],
    ['QUEIJO', 2],
    ['GUERRA', 2],
    ['SAÚDE', 3],
    ['BANANA', 3],
  ])('%s has %i syllable(s)', (word, expected) => {
    expect(countSyllables(word)).toBe(expected);
  });
});

describe('validateProposals', () => {
  const words = { unitId: 'palavras-dissilabas', type: 'word', existing: ['BOLA', 'PATO'] };

  it('accepts valid new words', () => {
    const { accepted, rejected } = validateProposals(['GATO', 'CASA'], words);
    expect(accepted).toEqual(['GATO', 'CASA']);
    expect(rejected).toEqual([]);
  });

  it('rejects duplicates against the pool and within the batch, ignoring accents', () => {
    const { accepted, rejected } = validateProposals(['bola'.toUpperCase(), 'CASA', 'CASA'], words);
    expect(accepted).toEqual(['CASA']);
    expect(rejected.map((r) => r.reason)).toEqual(['duplicada', 'duplicada']);
  });

  it('rejects lowercase, wrong format, wrong syllable count and blocklisted words', () => {
    const { accepted, rejected } = validateProposals(
      ['gato', 'AB1', 'BANANA', 'BOSTA'],
      words,
    );
    expect(accepted).toEqual([]);
    expect(rejected.map((r) => r.reason)).toEqual([
      'não está em MAIÚSCULAS',
      'formato inválido para word',
      'esperado 2 sílaba(s), contou 3',
      'palavra na lista de bloqueio',
    ]);
  });

  it('enforces one letter for letter units and 2-3 letters for syllable units', () => {
    expect(
      validateProposals(['A', 'AB'], { unitId: 'alfabeto', type: 'letter', existing: [] }).accepted,
    ).toEqual(['A']);
    expect(
      validateProposals(['BA', 'BLAS', 'B'], { unitId: 'silabas-b', type: 'syllable', existing: [] })
        .accepted,
    ).toEqual(['BA']);
  });
});
