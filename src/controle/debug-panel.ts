import { el } from '../ui/dom.js';
import type { JumpDetectorThresholds } from './jump-detector.js';
import { saveThresholds } from './threshold-storage.js';

/** Triggers a browser download of `content` as a file — no server round-trip needed. */
export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: filename }) as HTMLAnchorElement;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Lets a threshold be tuned live against a real child (§10) without a
 * rebuild. Mutates `thresholds` in place — the same object instance the
 * `JumpDetector` was constructed with reads its fields fresh on every
 * `feed()` call, so no extra wiring is needed to push the change through.
 */
export function renderDebugPanel(
  root: HTMLElement,
  thresholds: JumpDetectorThresholds,
  {
    onDownload,
    onMarkJump,
    getMarkCount,
    onReset,
  }: { onDownload: () => void; onMarkJump: () => number; getMarkCount: () => number; onReset: () => void },
): void {
  const panel = el('div', { class: 'controle-debug-panel' });
  const fields: Array<[keyof JumpDetectorThresholds, string, number, number, number]> = [
    ['freefallDeltaG', 'Queda livre (g)', 0.05, 1, 0.05],
    ['impactDeltaG', 'Impacto (g)', 0.1, 2, 0.05],
    ['minFreefallMs', 'Queda mín. (ms)', 0, 400, 10],
    ['maxFreefallMs', 'Queda máx. (ms)', 200, 1500, 10],
    ['cooldownMs', 'Cooldown (ms)', 100, 1500, 10],
    ['takeoffDeltaG', 'Decolagem (g, 0=só pouso)', 0, 1.5, 0.05],
    ['takeoffWindowMs', 'Janela decolagem (ms)', 50, 600, 10],
  ];

  for (const [key, label, min, max, step] of fields) {
    const valueLabel = el('span', { class: 'controle-debug-value', text: String(thresholds[key]) });
    const input = el('input', {
      type: 'range',
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(thresholds[key]),
      onInput: (event: Event) => {
        const target = event.target as HTMLInputElement;
        // minFreefallMs >= maxFreefallMs makes a jump impossible to confirm:
        // the freefall state resets to idle once maxFreefallMs elapses, so a
        // longer minFreefallMs would never get the chance to be reached.
        // Clamp instead of letting the panel silently produce a dead config.
        let value = Number(target.value);
        if (key === 'minFreefallMs') value = Math.min(value, thresholds.maxFreefallMs - 10);
        if (key === 'maxFreefallMs') value = Math.max(value, thresholds.minFreefallMs + 10);
        thresholds[key] = value;
        target.value = String(value);
        valueLabel.textContent = String(value);
        saveThresholds(thresholds);
      },
    });
    panel.append(el('label', { class: 'controle-debug-row' }, [label, input, valueLabel]));
  }

  // Ground truth for offline replay: tap right after each real jump so
  // recorded detections can be scored as hits, false positives or misses.
  const markCount = el('span', { class: 'controle-debug-value', text: String(getMarkCount()) });
  panel.append(
    el('div', { class: 'controle-debug-row' }, [
      el('button', {
        class: 'controle-debug-mark',
        type: 'button',
        text: 'Pulei agora',
        onClick: () => {
          markCount.textContent = String(onMarkJump());
        },
      }),
      markCount,
    ]),
  );

  panel.append(
    el('div', { class: 'controle-debug-row' }, [
      el('button', {
        class: 'controle-debug-reset',
        type: 'button',
        text: 'Restaurar limiares padrão',
        onClick: onReset,
      }),
    ]),
  );

  panel.append(
    el('div', { class: 'controle-debug-row' }, [
      el('button', {
        class: 'controle-debug-download',
        type: 'button',
        text: 'Baixar sessão do sensor (.json)',
        onClick: onDownload,
      }),
    ]),
  );

  root.append(panel);
}
