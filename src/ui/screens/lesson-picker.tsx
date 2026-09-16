import { mountScreen, blurOnClick } from './mount-screen.js';
import type { Unit, Lesson } from '../../content/curriculum-model.js';

interface LessonPickerOptions {
  units: Unit[];
  isUnlocked: (lessonId: string) => boolean;
  onPick: (lessonId: string) => void;
  onBack: () => void;
}

function UnitGroup({ unit, isUnlocked, onPick }: { unit: Unit; isUnlocked: (id: string) => boolean; onPick: (id: string) => void }) {
  const lessons = unit.lessons.filter((lesson: Lesson) => isUnlocked(lesson.id));
  return (
    <div>
      <h2>{unit.title}</h2>
      <div className="overlay-actions">
        {lessons.length > 0 ? (
          lessons.map((lesson) => (
            <button key={lesson.id} type="button" tabIndex={-1} onClick={blurOnClick(() => onPick(lesson.id))}>
              {lesson.target}
            </button>
          ))
        ) : (
          <p>Conclua a fase anterior para liberar.</p>
        )}
      </div>
    </div>
  );
}

function LessonPickerScreen({ units, isUnlocked, onPick, onBack }: LessonPickerOptions) {
  return (
    <div className="overlay">
      <h2>Escolha uma fase</h2>
      <div className="overlay-scroll">
        {units.map((unit) => (
          <UnitGroup key={unit.id} unit={unit} isUnlocked={isUnlocked} onPick={onPick} />
        ))}
      </div>
      <div className="overlay-actions">
        <button type="button" tabIndex={-1} className="primary" onClick={blurOnClick(onBack)}>
          Voltar
        </button>
      </div>
    </div>
  );
}

export function buildLessonPickerScreen(options: LessonPickerOptions) {
  const { node, cleanup } = mountScreen(<LessonPickerScreen {...options} />);
  return { node, primary: options.onBack, back: options.onBack, cleanup };
}
