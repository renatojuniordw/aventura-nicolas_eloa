import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Architectural fitness functions.
 *
 * These tests encode the project's non-negotiable rules as executable checks,
 * so a future change that violates them fails CI instead of silently eroding
 * the design. The most important one is the input abstraction: gameplay logic
 * must never live in a keyboard handler.
 */

const SRC_DIR = fileURLToPath(new URL('.', import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sourceFiles = walk(SRC_DIR).filter(
  (file) => file.endsWith('.js') && !file.endsWith('.test.js'),
);

function read(file) {
  return readFileSync(file, 'utf8');
}

describe('architecture: input abstraction', () => {
  it('the input layer never depends on gameplay, physics, render or scenes', () => {
    const inputFiles = sourceFiles.filter((file) => file.includes('/input/'));
    expect(inputFiles.length).toBeGreaterThan(0);
    const forbidden = /from\s+['"][^'"]*(gameplay|physics|scenes|render)[^'"]*['"]/;
    for (const file of inputFiles) {
      expect(read(file), `${file} must not import gameplay/physics/render/scenes`).not.toMatch(
        forbidden,
      );
    }
  });

  it('keyboard listeners exist only inside the input layer', () => {
    const offenders = sourceFiles.filter(
      (file) =>
        !file.includes('/input/') && /addEventListener\(\s*['"](keydown|keyup)['"]/.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });

  it('physical key codes are handled only inside the input layer', () => {
    const offenders = sourceFiles.filter(
      (file) => !file.includes('/input/') && /\.code\b|event\.repeat/.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });

  it('the jump impulse is applied only by the player controller', () => {
    const allowed = ['config.js', 'player-controller.js'];
    const offenders = sourceFiles.filter(
      (file) =>
        read(file).includes('jumpVelocity') && !allowed.some((name) => file.endsWith(name)),
    );
    expect(offenders).toEqual([]);
  });

  it('semantic actions are never redefined outside actions.js', () => {
    const offenders = sourceFiles.filter(
      (file) => !file.endsWith('actions.js') && /moveLeft'\s*:/.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });
});
