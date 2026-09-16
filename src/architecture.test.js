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

const SOURCE_EXTENSION = /\.(js|jsx|ts|tsx)$/;
const TEST_EXTENSION = /\.test\.(js|jsx|ts|tsx)$/;

const sourceFiles = walk(SRC_DIR).filter(
  (file) => SOURCE_EXTENSION.test(file) && !TEST_EXTENSION.test(file),
);

function read(file) {
  return readFileSync(file, 'utf8');
}

function hasBasename(file, name) {
  return SOURCE_EXTENSION.test(file) && file.replace(SOURCE_EXTENSION, '').endsWith(`/${name}`);
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
    const allowed = ['config', 'player-controller'];
    const offenders = sourceFiles.filter(
      (file) =>
        read(file).includes('jumpVelocity') && !allowed.some((name) => hasBasename(file, name)),
    );
    expect(offenders).toEqual([]);
  });

  it('semantic actions are never redefined outside actions.js', () => {
    const offenders = sourceFiles.filter(
      (file) => !hasBasename(file, 'actions') && /moveLeft'\s*:/.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });
});

describe('architecture: React stays out of the engine', () => {
  it('React components never import from the engine layers', () => {
    const reactFiles = sourceFiles.filter((file) => /\.(jsx|tsx)$/.test(file));
    const engineLayer = /from\s+['"][^'"]*\/(core|physics|gameplay|render|scenes)\//;
    const nonUiReactFiles = reactFiles.filter((file) => !file.includes('/ui/'));
    expect(nonUiReactFiles, 'React files must live under src/ui/').toEqual([]);

    for (const file of reactFiles) {
      expect(read(file), `${file} must not import engine layers`).not.toMatch(engineLayer);
    }
  });

  it('engine layers never import React', () => {
    const engineFiles = sourceFiles.filter(
      (file) =>
        /\/(core|physics|gameplay|render|scenes)\//.test(file) && !file.includes('/ui/'),
    );
    const reactImport = /from\s+['"]react(-dom)?(\/[^'"]*)?['"]/;
    for (const file of engineFiles) {
      expect(read(file), `${file} must not import react`).not.toMatch(reactImport);
    }
  });
});
