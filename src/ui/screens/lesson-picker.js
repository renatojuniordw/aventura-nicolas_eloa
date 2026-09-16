import { button, el } from '../dom.js';

/**
 * @param {{ units: Array, isUnlocked: (lessonId: string) => boolean, onPick, onBack }} options
 * @returns {{ node: HTMLElement, primary: () => void, back: () => void }}
 */
export function buildLessonPickerScreen({ units, isUnlocked, onPick, onBack }) {
  const groups = units.map((unit) => {
    const lessons = unit.lessons.filter((lesson) => isUnlocked(lesson.id));
    return el('div', {}, [
      el('h2', { text: unit.title }),
      el(
        'div',
        { class: 'overlay-actions' },
        lessons.length > 0
          ? lessons.map((lesson) => button(lesson.target, { onClick: () => onPick(lesson.id) }))
          : [el('p', { text: 'Conclua a fase anterior para liberar.' })],
      ),
    ]);
  });

  const node = el('div', { class: 'overlay' }, [
    el('h2', { text: 'Escolha uma fase' }),
    el('div', { class: 'overlay-scroll' }, groups),
    el('div', { class: 'overlay-actions' }, [button('Voltar', { primary: true, onClick: onBack })]),
  ]);

  return { node, primary: onBack, back: onBack };
}
