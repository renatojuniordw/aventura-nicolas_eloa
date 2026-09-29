import { useRef, type CSSProperties, type RefObject } from 'react';
import { buildScreen } from './mount-screen.js';
import { MenuButton } from './menu-button.js';
import { gridCapacity, PaginationControls, panelBox, useArea, useBoxSize, usePager, type Size } from './layout.js';

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

/*
 * "Escolher aventura" (docs/20 §4 L1) in three short levels — worlds, a
 * world's units, a unit's lessons — each a paginated screen that fits
 * without scrolling (docs/22 M07). Every level opens on the page holding the
 * next lesson; Voltar goes one level up, back to the page it came from.
 */

/** Heading, pager and footer around a collection, in rem, before the first layout. */
const CHROME_REM = 12;

function useCollectionBox(body: RefObject<HTMLDivElement | null>): { box: Size; rem: number } {
  const area = useArea();
  const box = useBoxSize(body, panelBox(area, CHROME_REM));
  return { box, rem: area.rem };
}

interface WorldListOptions {
  worlds: WorldMapWorld[];
  onOpenWorld: (worldId: string) => void;
  onBack: () => void;
}

function WorldList({ worlds, onOpenWorld, onBack }: WorldListOptions) {
  const current = worlds.find((world) => world.current) ?? worlds[0];
  const body = useRef<HTMLDivElement>(null);
  const { box, rem } = useCollectionBox(body);
  const pager = usePager({
    id: 'worlds',
    items: worlds,
    getId: (world) => world.id,
    // Long descriptions wrap: a world card is sized for three lines of description, never clipped.
    capacity: gridCapacity(box, rem, { width: 17, height: 7, maxColumns: 2 }),
    start: current?.id,
  });
  return (
    <div className="overlay screen screen-fill world-map-screen">
      <header className="screen-head">
        <h1>Escolher aventura</h1>
        <p>Escolha um mundo para brincar.</p>
      </header>
      <div className="screen-body" ref={body}>
        <ul className="world-list">
          {pager.items.map((world) => (
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
                  <span className="world-card-progress">
                    {world.done} de {world.total} fases{world.current && <span className="world-card-here"> · 📍 Você está aqui</span>}
                  </span>
                </span>
              </MenuButton>
            </li>
          ))}
        </ul>
      </div>
      <div className="screen-nav">
        <PaginationControls pager={pager} label="Páginas dos mundos" itemNoun="Mundo" />
        <div className="overlay-actions screen-foot">
          <MenuButton data-nav-id="back" onClick={onBack}>Voltar ao menu</MenuButton>
        </div>
      </div>
    </div>
  );
}

/** Step 1: one card per world; the current one is marked in text and starts focused. */
export function buildWorldListScreen(options: WorldListOptions) {
  const current = options.worlds.find((world) => world.current) ?? options.worlds[0];
  return buildScreen(<WorldList {...options} />, {
    primary: current ? () => options.onOpenWorld(current.id) : options.onBack,
    back: options.onBack,
  });
}

const unitHasNext = (unit: WorldMapUnit) => unit.lessons.some((lesson) => lesson.state === 'next');

function unitStatus(unit: WorldMapUnit): { mark: string; text: string } {
  if (unitHasNext(unit)) return { mark: '★', text: 'próxima descoberta aqui' };
  if (unit.done === unit.lessons.length) return { mark: '✔', text: 'completa' };
  if (unit.done > 0) return { mark: '◐', text: 'começada' };
  return { mark: '🔒', text: 'ainda não liberada' };
}

interface WorldDetailOptions {
  world: WorldMapWorld;
  onOpenUnit: (unitId: string) => void;
  onBack: () => void;
}

function WorldDetail({ world, onOpenUnit, onBack }: WorldDetailOptions) {
  const focus = world.units.find(unitHasNext) ?? world.units.find((unit) => unit.done < unit.lessons.length) ?? world.units[0];
  const body = useRef<HTMLDivElement>(null);
  const { box, rem } = useCollectionBox(body);
  const pager = usePager({
    id: `units-${world.id}`,
    items: world.units,
    getId: (unit) => unit.id,
    capacity: gridCapacity(box, rem, { width: 12, height: 4, maxColumns: 3 }),
    start: focus?.id,
  });
  return (
    <div className="overlay screen screen-fill world-map-screen">
      <header className="screen-head">
        <h1><span aria-hidden="true">{world.icon} </span>{world.title}</h1>
        <p>{world.done} de {world.total} fases · escolha uma parte</p>
      </header>
      <div className="screen-body" ref={body}>
        <ul className="unit-list">
          {pager.items.map((unit) => {
            const status = unitStatus(unit);
            return (
              <li key={unit.id}>
                <MenuButton
                  className={`unit-card${unitHasNext(unit) ? ' is-current' : ''}`}
                  data-nav-id={`unit-${unit.id}`}
                  data-autofocus={unit.id === focus?.id ? '' : undefined}
                  aria-label={`${unit.title}, ${unit.done} de ${unit.lessons.length} fases, ${status.text}`}
                  onClick={() => onOpenUnit(unit.id)}
                >
                  <strong>{unit.title}</strong>
                  <small><span aria-hidden="true">{status.mark} </span>{unit.done} de {unit.lessons.length}</small>
                </MenuButton>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="screen-nav">
        <PaginationControls pager={pager} label={`Páginas de ${world.title}`} />
        <div className="overlay-actions screen-foot">
          <MenuButton data-nav-id="back" onClick={onBack}>Voltar aos mundos</MenuButton>
        </div>
      </div>
    </div>
  );
}

/** Step 2: a world's units; the one holding the next lesson is marked and focused. */
export function buildWorldDetailScreen(options: WorldDetailOptions) {
  const focus = options.world.units.find(unitHasNext) ?? options.world.units[0];
  return buildScreen(<WorldDetail {...options} />, {
    primary: focus ? () => options.onOpenUnit(focus.id) : options.onBack,
    back: options.onBack,
  });
}

interface UnitLessonsOptions {
  world: WorldMapWorld;
  unit: WorldMapUnit;
  freePractice: boolean;
  onPlayLesson: (lessonId: string) => void;
  onToggleFreePractice: () => void;
  /** "Voltar às partes" or, for a one-unit world, "Voltar aos mundos". */
  backLabel?: string;
  onBack: () => void;
}

const STATE_TEXT: Record<LessonState, string> = {
  done: 'já aprendida',
  next: 'próxima descoberta',
  locked: 'ainda não liberada',
};

const STATE_MARK: Record<LessonState, string> = { done: '✔', next: '★', locked: '🔒' };

const focusLessonOf = (unit: WorldMapUnit) =>
  unit.lessons.find((lesson) => lesson.state === 'next') ?? unit.lessons.find((lesson) => lesson.playable);

function UnitLessons({ world, unit, freePractice, onPlayLesson, onToggleFreePractice, backLabel = 'Voltar às partes', onBack }: UnitLessonsOptions) {
  const focus = focusLessonOf(unit);
  const hasLocked = unit.lessons.some((lesson) => lesson.state === 'locked');
  const body = useRef<HTMLDivElement>(null);
  const { box, rem } = useCollectionBox(body);
  // Chips are as wide as the longest target (a letter, a syllable or a whole word) so labels never spill.
  const chipRem = Math.max(4.5, 2.5 + 0.75 * Math.max(1, ...unit.lessons.map((lesson) => lesson.target.length)));
  const pager = usePager({
    id: `lessons-${unit.id}`,
    items: unit.lessons,
    getId: (lesson) => lesson.id,
    capacity: gridCapacity(box, rem, { width: chipRem, height: 3, gap: 0.5 }),
    start: focus?.id,
  });
  return (
    <div className="overlay screen screen-fill world-map-screen">
      <header className="screen-head">
        <h1><span aria-hidden="true">{world.icon} </span>{unit.title}</h1>
        <p>{unit.done} de {unit.lessons.length} fases{freePractice ? ' · todas liberadas para praticar' : ''}</p>
      </header>
      <div className="screen-body" ref={body}>
        <ul className="lesson-chips" style={{ '--chip-min': `${chipRem}rem` } as CSSProperties}>
          {pager.items.map((lesson) => (
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
      </div>
      <div className="screen-nav">
        <PaginationControls pager={pager} label={`Páginas de ${unit.title}`} />
        <div className="overlay-actions screen-foot">
          <MenuButton data-nav-id="back" onClick={onBack}>{backLabel}</MenuButton>
          {(hasLocked || freePractice) && (
            <MenuButton className="btn-util world-free-practice" data-nav-id="free-practice" aria-pressed={freePractice} onClick={onToggleFreePractice}>
              {freePractice ? 'Voltar à trilha em ordem' : 'Liberar todas (com um adulto)'}
            </MenuButton>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Step 3: a unit's lessons as chips. Done lessons can be replayed without
 * losing progress; the next one is marked and focused; the rest wait unless
 * an adult turns on free practice.
 */
export function buildUnitLessonsScreen(options: UnitLessonsOptions) {
  const focus = focusLessonOf(options.unit);
  return buildScreen(<UnitLessons {...options} />, {
    primary: focus ? () => options.onPlayLesson(focus.id) : options.onBack,
    back: options.onBack,
  });
}
