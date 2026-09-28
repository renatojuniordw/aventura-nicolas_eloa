import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';

/** One lesson chip: done, the next one to play, or not reached yet. */
export type LessonState = 'done' | 'next' | 'locked';

export interface WorldMapLesson {
  id: string;
  target: string;
  state: LessonState;
  /** Playable now: done, next, or any lesson while free practice is on. */
  playable: boolean;
}

export interface WorldMapUnit {
  id: string;
  title: string;
  done: number;
  lessons: WorldMapLesson[];
}

export interface WorldMapWorld {
  id: string;
  title: string;
  icon: string;
  description: string;
  done: number;
  total: number;
  /** The world holding the next lesson ("Você está aqui"). */
  current: boolean;
  units: WorldMapUnit[];
}

interface WorldListOptions {
  worlds: WorldMapWorld[];
  onOpenWorld: (worldId: string) => void;
  onBack: () => void;
}

/**
 * "Escolher aventura", step 1 (docs/20 §4 L1): one card per world, stacked in
 * a single scroll on phones. The current world is marked with text, not only
 * a colour, and is the start focus.
 */
export function buildWorldListScreen({ worlds, onOpenWorld, onBack }: WorldListOptions) {
  const current = worlds.find((world) => world.current) ?? worlds[0];
  return buildScreen(
    <div className="overlay world-map-screen">
      <h1>Escolher aventura</h1>
      <p>Escolha um mundo para brincar.</p>
      <MenuButton data-nav-id="back" onClick={onBack}>Voltar ao menu</MenuButton>
      <ul className="world-list">
        {worlds.map((world) => (
          <li key={world.id}>
            <MenuButton
              className={world.current ? 'world-card is-current' : 'world-card'}
              data-nav-id={`world-${world.id}`}
              data-autofocus={world.id === current?.id ? '' : undefined}
              aria-label={`${world.title}. ${world.description}. ${world.done} de ${world.total} fases${world.current ? '. Você está aqui' : ''}`}
              onClick={() => onOpenWorld(world.id)}
            >
              <span className="world-card-icon" aria-hidden="true">{world.icon}</span>
              <span className="world-card-body">
                <strong>{world.title}</strong>
                <small>{world.description}</small>
                <span className="world-card-progress">{world.done} de {world.total} fases</span>
              </span>
              {world.current && <span className="world-card-here">📍 Você está aqui</span>}
            </MenuButton>
          </li>
        ))}
      </ul>
    </div>,
    { primary: current ? () => onOpenWorld(current.id) : onBack, back: onBack },
  );
}

interface WorldDetailOptions {
  world: WorldMapWorld;
  freePractice: boolean;
  onPlayLesson: (lessonId: string) => void;
  onToggleFreePractice: () => void;
  onBack: () => void;
}

const STATE_TEXT: Record<LessonState, string> = {
  done: 'já aprendida',
  next: 'próxima descoberta',
  locked: 'ainda não liberada',
};

const STATE_MARK: Record<LessonState, string> = { done: '✔', next: '★', locked: '🔒' };

/**
 * "Escolher aventura", step 2: the world's units, each with its lessons as
 * chips. Done lessons can be replayed without losing progress; the next one is
 * marked and focused; the rest wait unless an adult turns on free practice.
 */
export function buildWorldDetailScreen({ world, freePractice, onPlayLesson, onToggleFreePractice, onBack }: WorldDetailOptions) {
  const lessons = world.units.flatMap((unit) => unit.lessons);
  const focus = lessons.find((lesson) => lesson.state === 'next') ?? lessons.find((lesson) => lesson.playable);
  const hasLocked = lessons.some((lesson) => lesson.state === 'locked');
  return buildScreen(
    <div className="overlay world-map-screen">
      <h1><span aria-hidden="true">{world.icon} </span>{world.title}</h1>
      <p>{world.description} · {world.done} de {world.total} fases</p>
      <MenuButton data-nav-id="back" onClick={onBack}>Voltar aos mundos</MenuButton>
      {world.units.map((unit) => (
        <section className="world-unit" key={unit.id} aria-labelledby={`unit-${unit.id}`}>
          <h2 id={`unit-${unit.id}`}>{unit.title} <small>{unit.done} de {unit.lessons.length}</small></h2>
          <ul className="lesson-chips">
            {unit.lessons.map((lesson) => (
              <li key={lesson.id}>
                <MenuButton
                  className={`lesson-chip is-${lesson.state}`}
                  data-nav-id={`lesson-${lesson.id}`}
                  data-autofocus={lesson.id === focus?.id ? '' : undefined}
                  disabled={!lesson.playable}
                  aria-label={`${lesson.target}, ${STATE_TEXT[lesson.state]}`}
                  onClick={() => onPlayLesson(lesson.id)}
                >
                  <span className="lesson-chip-mark" aria-hidden="true">{STATE_MARK[lesson.state]}</span>
                  {lesson.target}
                </MenuButton>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {(hasLocked || freePractice) && (
        <MenuButton className="btn-util world-free-practice" data-nav-id="free-practice" aria-pressed={freePractice} onClick={onToggleFreePractice}>
          {freePractice ? 'Voltar à trilha em ordem' : 'Liberar todas para praticar com um adulto'}
        </MenuButton>
      )}
    </div>,
    { primary: focus ? () => onPlayLesson(focus.id) : onBack, back: onBack },
  );
}
