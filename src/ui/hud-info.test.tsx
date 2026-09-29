// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { HudModel, FeedbackKind } from '../render/hud-model.js';
import { hudSnapshot, hudSnapshotKey } from './hud-info.js';
import { HudControls } from './hud-controls.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function explorerModel() {
  const model = new HudModel({ objective: 'Monte a palavra: PAPAI', levelName: 'Quintal', lives: 2, isSpeedrun: true, speedrunProgress: '2/3', showTimer: false });
  model.setWordBoard(['P', 'A', 'P', 'A', 'I'], 2);
  return model;
}

describe('hudSnapshot (docs/17 §4 entrega 5)', () => {
  it('copies what the DOM HUD shows, with the badge text built once', () => {
    const model = new HudModel({ objective: 'Colete a letra G', levelName: 'Letra G', isSpeedrun: true, timer: 62, speedrunProgress: '3/10' });
    const snapshot = hudSnapshot(model);
    expect(snapshot).toMatchObject({ levelName: 'Letra G', objective: 'Colete a letra G', lives: 3, maxLives: 3, feedback: null, board: [] });
    expect(snapshot.badge).toMatch(/^⏱️ .+ · 3\/10$/);
    expect(hudSnapshot(new HudModel()).badge).toBe('');
    expect(hudSnapshot(explorerModel()).badge).toBe('2/3');
  });

  it('shows feedback only while visible', () => {
    const model = new HudModel();
    model.showFeedback(FeedbackKind.CORRECT, 'Isso!', 1);
    expect(hudSnapshot(model).feedback).toEqual({ kind: 'correct', message: 'Isso!' });
    model.update(2);
    expect(hudSnapshot(model).feedback).toBeNull();
  });

  it('the key changes only when something visible changes (no per-frame re-render)', () => {
    const model = new HudModel({ objective: 'x', isSpeedrun: true, timer: 1 });
    const before = hudSnapshotKey(hudSnapshot(model));
    model.setTimer(1.001);
    expect(hudSnapshotKey(hudSnapshot(model))).toBe(before);
    model.setLives(1);
    expect(hudSnapshotKey(hudSnapshot(model))).not.toBe(before);
  });
});

describe('HudControls: informative HUD in DOM', () => {
  function mount() {
    const root = document.createElement('div');
    document.body.append(root);
    const controls = new HudControls({ root });
    act(() => controls.showPauseButton({ onPause: vi.fn() }));
    return { root, controls };
  }

  it('renders level, badge, objective, letter board and hearts beside the buttons', () => {
    const { root, controls } = mount();
    act(() => controls.updateInfo(hudSnapshot(explorerModel())));
    expect(root.querySelector('.hud-level')?.textContent).toBe('Fase: Quintal');
    expect(root.querySelector('.hud-badge')?.textContent).toBe('2/3');
    expect(root.querySelector('.hud-objective')?.textContent).toBe('Monte a palavra: PAPAI');
    expect([...root.querySelectorAll('.hud-slot')].map((s) => s.textContent)).toEqual(['P', 'A', '_', '_', '_']);
    expect(root.querySelector('.hud-slot.is-next')?.textContent).toBe('_');
    expect(root.querySelector('.hud-board')?.getAttribute('aria-label')).toBe('Palavra: 2 de 5 letras encontradas');
    const hearts = root.querySelector('.hud-hearts')!;
    expect(hearts.getAttribute('aria-label')).toBe('Vidas: 2 de 3');
    expect(hearts.querySelectorAll('.hud-heart.is-full')).toHaveLength(2);
    // Same row as the buttons, in their own column: they cannot overlap.
    expect(hearts.parentElement?.classList.contains('hud-side')).toBe(true);
    expect(hearts.parentElement?.querySelector('.hud-controls-bar .pause-btn')).not.toBeNull();
    // Not a live region: LiveAnnouncer already announces the objective once.
    expect(root.querySelector('[aria-live]')).toBeNull();
    act(() => controls.hidePauseButton());
    root.remove();
  });

  it('marks the answer banner with a sign, not only a colour, and removes it when it fades', () => {
    const { root, controls } = mount();
    const model = new HudModel({ objective: 'Colete a letra G' });
    model.showFeedback(FeedbackKind.WRONG, 'Ops! Procure a G.', 1);
    act(() => controls.updateInfo(hudSnapshot(model)));
    const banner = root.querySelector('.hud-feedback')!;
    expect(banner.classList.contains('is-wrong')).toBe(true);
    expect(banner.textContent).toBe('✖ Ops! Procure a G.');
    model.update(2);
    act(() => controls.updateInfo(hudSnapshot(model)));
    expect(root.querySelector('.hud-feedback')).toBeNull();
    act(() => controls.hidePauseButton());
    root.remove();
  });

  it('re-renders only on a real change and forgets the match when hidden', () => {
    const { root, controls } = mount();
    const model = new HudModel({ objective: 'Colete a letra G' });
    act(() => controls.updateInfo(hudSnapshot(model)));
    const objective = root.querySelector('.hud-objective');
    act(() => controls.updateInfo(hudSnapshot(model)));
    expect(root.querySelector('.hud-objective')).toBe(objective);
    act(() => controls.hidePauseButton());
    act(() => controls.showPauseButton({ onPause: vi.fn() }));
    expect(root.querySelector('.hud-objective')).toBeNull();
    act(() => controls.hidePauseButton());
    root.remove();
  });
});
