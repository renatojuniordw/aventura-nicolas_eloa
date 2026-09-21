#!/usr/bin/env node
/**
 * Reproduz uma gravação do `/controle?debug=1` contra o JumpDetector e varre
 * combinações de limiares, comparando com os marcadores "pulei agora".
 *
 * Uso: npm run replay:session -- caminho/joguinho-sensor-123.json [--trackRest]
 */

import { readFileSync } from 'node:fs';

import { DEFAULT_JUMP_DETECTOR_THRESHOLDS } from '../src/controle/jump-detector.js';
import {
  replaySession,
  scoreDetections,
  sweepThresholds,
  thresholdGrid,
  type SessionRecording,
} from '../src/controle/session-replay.js';

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('Uso: npm run replay:session -- <gravacao.json> [--trackRest]');
  process.exit(1);
}
const trackRest = flags.includes('--trackRest');
const recording = JSON.parse(readFileSync(file, 'utf8')) as SessionRecording;
const markers = recording.markers ?? [];
const jumpMarkers = markers.filter((m) => m.kind === 'jump').length;

console.log(`${recording.samples.length} amostras, ${jumpMarkers} marcadores de pulo`);
if (jumpMarkers === 0) console.log('Sem marcadores "pulei agora": só dá para listar detecções, não pontuar.');

const fmt = (n: number | null, digits = 2): string => (n === null ? '  n/d' : n.toFixed(digits));

console.log('\n== Limiares padrão ==');
const baseline = replaySession(recording, DEFAULT_JUMP_DETECTOR_THRESHOLDS, { trackRest });
const baselineScore = scoreDetections(baseline, markers);
baseline.forEach((d, i) => {
  const label = jumpMarkers === 0 ? '?' : baselineScore.matched[i] ? 'ACERTO' : 'FALSO+';
  console.log(
    `t=${d.t.toFixed(0)}ms ${label} ${d.info.trigger} queda=${fmt(d.info.freefallMs, 0)}ms mín=${fmt(d.info.minFreefallG)}g impacto=${fmt(d.info.impactG)}g decolagem=${fmt(d.info.takeoffG)}g rot=${fmt(d.rotationPeak, 0)}°/s`,
  );
});
console.log(
  `acertos=${baselineScore.hits} falsos+=${baselineScore.falsePositives} perdidos=${baselineScore.misses} f1=${baselineScore.f1.toFixed(2)}`,
);

if (jumpMarkers > 0) {
  console.log('\n== Varredura de limiares (top 10 por f1) ==');
  const grid = thresholdGrid({
    freefallDeltaG: [0.25, 0.3, 0.4, 0.5],
    impactDeltaG: [0.4, 0.55, 0.7, 0.85],
    minFreefallMs: [60, 100],
    takeoffDeltaG: [0, 0.3, 0.4, 0.6],
  });
  for (const { thresholds: t, score } of sweepThresholds(recording, grid, { trackRest }).slice(0, 10)) {
    console.log(
      `queda=${t.freefallDeltaG} impacto=${t.impactDeltaG} min=${t.minFreefallMs}ms decolagem=${t.takeoffDeltaG} → acertos=${score.hits} falsos+=${score.falsePositives} perdidos=${score.misses} f1=${score.f1.toFixed(2)}`,
    );
  }
}
