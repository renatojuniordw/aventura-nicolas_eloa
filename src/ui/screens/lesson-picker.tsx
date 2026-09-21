import { mountScreen, blurOnClick } from './mount-screen.js';
import type { Unit, Lesson } from '../../content/curriculum-model.js';
import { vibrateTap } from '../../input/haptics.js';

interface LessonPickerOptions {
  units: Unit[];
  isUnlocked: (lessonId: string) => boolean;
  onPick: (lessonId: string) => void;
  onBack: () => void;
}

function UnitGroup({ unit, isUnlocked, onPick }: { unit: Unit; isUnlocked: (id: string) => boolean; onPick: (id: string) => void }) {
  const lessons = unit.lessons.filter((lesson: Lesson) => isUnlocked(lesson.id));
  return (
    <div className="lesson-unit-group">
      <h3 className="lesson-unit-title">{unit.title}</h3>
      <div className="lesson-picker-grid">
        {lessons.length > 0 ? (
          lessons.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              tabIndex={-1}
              className="btn-retro lesson-pick-btn"
              onClick={blurOnClick(() => {
                vibrateTap();
                onPick(lesson.id);
              })}
            >
              <span className="lesson-target">{lesson.target}</span>
              <span className="lesson-badge" aria-hidden="true">⭐</span>
            </button>
          ))
        ) : (
          <p className="lesson-unit-locked">Conclua a fase anterior para liberar.</p>
        )}
      </div>
    </div>
  );
}

function LessonPickerScreen({ units, isUnlocked, onPick, onBack }: LessonPickerOptions) {
  return (
    <div className="menu-modal-screen">
      <div className="overlay lesson-picker-overlay">
        <h2>Escolha uma fase</h2>
        <p className="lesson-picker-subtitle">Selecione uma fase já liberada para jogar!</p>
        <div className="overlay-scroll lesson-picker-scroll">
          {units.map((unit) => (
            <UnitGroup key={unit.id} unit={unit} isUnlocked={isUnlocked} onPick={onPick} />
          ))}
        </div>
        <div className="overlay-actions lesson-picker-actions">
          <button type="button" tabIndex={-1} className="btn-retro btn-primary-gold" onClick={blurOnClick(onBack)}>
            Voltar ao Menu
          </button>
        </div>
      </div>
    </div>
  );
}

export function buildLessonPickerScreen(options: LessonPickerOptions) {
  const { node, cleanup } = mountScreen(<LessonPickerScreen {...options} />);
  return { node, primary: options.onBack, back: options.onBack, cleanup };
}
