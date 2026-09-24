#!/usr/bin/env node
/**
 * Gera um arquivo de fase por lição do currículo.
 *
 * As fases são *dados*: cada lição recebe um terreno a partir de um template e
 * os itens (alvo + distratores) a partir do currículo. Nada aqui é importado em
 * tempo de execução — a saída é JSON versionado, validado pelo próprio
 * `loadLevel`, de modo que um erro de conteúdo falha na geração, não no jogo.
 *
 * Uso: npm run generate:levels
 */

import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expandCurriculum } from '../src/content/curriculum-model.js';
import { TEMPLATES, buildLessonLevel } from '../src/content/level-templates.js';
import { loadLevel } from '../src/content/level-loader.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CURRICULUM_PATH = join(ROOT, 'src', 'content', 'curriculum.json');
const OUTPUT_DIR = join(ROOT, 'src', 'content', 'levels');

// --- Main -------------------------------------------------------------------
function main() {
  const curriculum = JSON.parse(readFileSync(CURRICULUM_PATH, 'utf8'));
  const { units } = expandCurriculum(curriculum);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Remove previously generated levels so removed lessons do not linger.
  for (const file of readdirSync(OUTPUT_DIR)) {
    if (file.startsWith('fase-') && file.endsWith('.json')) {
      unlinkSync(join(OUTPUT_DIR, file));
    }
  }

  const written = [];
  let levelIndex = 0;
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      const template = TEMPLATES[levelIndex % TEMPLATES.length]();
      levelIndex += 1;
      const level = buildLessonLevel(lesson, unit, template);

      // Fail loudly on malformed content instead of shipping a broken level.
      loadLevel(level);
      writeFileSync(
        join(OUTPUT_DIR, `${lesson.levelId}.json`),
        `${JSON.stringify(level, null, 2)}\n`,
        'utf8',
      );
      written.push(lesson.levelId);
    }
  }

  process.stdout.write(
    `Geradas ${written.length} fases em src/content/levels/ (a partir de ${units.length} unidades).\n`,
  );
}

main();
