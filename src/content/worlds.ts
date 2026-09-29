/**
 * Worlds: a presentation layer over the curriculum units (docs/20 §4 L1/L3).
 *
 * A world only groups units for the "Escolher aventura" map; lesson ids, the
 * unlock order and saves stay exactly as the curriculum defines them. Every
 * unit belongs to exactly one world (checked by `worlds.test.ts`).
 */
export interface World {
  id: string;
  title: string;
  /** Decorative emoji; the title always carries the meaning. */
  icon: string;
  description: string;
  /**
   * Panoramic background every lesson of this world is played on (docs/20
   * §4 L3), so a world keeps a stable, recognisable look. Keys of
   * `render/asset-plan.ts` BACKGROUND_ASSETS.
   */
  background: string;
  unitIds: readonly string[];
}

export const WORLDS: readonly World[] = [
  {
    id: 'jardim-das-letras',
    title: 'Jardim das Letras',
    icon: '🌷',
    description: 'O alfabeto de A a Z',
    background: 'bg:garden-pixel',
    unitIds: ['alfabeto'],
  },
  {
    id: 'pomar-das-silabas',
    title: 'Pomar das Sílabas',
    icon: '🍎',
    description: 'As famílias silábicas',
    background: 'bg:primavera-pomar',
    unitIds: [
      'silabas-b', 'silabas-c', 'silabas-d', 'silabas-f', 'silabas-g', 'silabas-l',
      'silabas-m', 'silabas-p', 'silabas-s', 'silabas-t', 'silabas-v',
    ],
  },
  {
    id: 'vale-dos-desafios',
    title: 'Vale dos Desafios',
    icon: '⛰️',
    description: 'Dígrafos e encontros de consoantes',
    background: 'bg:outono-vale',
    unitIds: ['digrafos', 'encontros-consonantais'],
  },
  {
    id: 'lago-das-palavras',
    title: 'Lago das Palavras',
    icon: '🌊',
    description: 'Palavras curtas de uma e duas sílabas',
    background: 'bg:primavera-lago',
    unitIds: ['palavras-monossilabas', 'palavras-dissilabas'],
  },
  {
    id: 'bosque-das-descobertas',
    title: 'Bosque das Descobertas',
    icon: '🌳',
    description: 'Palavras por tema: animais, alimentos, casa, brinquedos, família, cozinha e corpo',
    background: 'bg:outono-bosque',
    unitIds: [
      'palavras-animais', 'palavras-alimentos', 'palavras-casa', 'palavras-brinquedos', 'palavras-familia',
      'palavras-cozinha', 'palavras-corpo',
    ],
  },
];

export function getWorld(worldId: string | null | undefined): World | null {
  return WORLDS.find((world) => world.id === worldId) ?? null;
}

/** The world that holds `unitId`, or null. */
export function worldOfUnit(unitId: string | null | undefined): World | null {
  return WORLDS.find((world) => unitId != null && world.unitIds.includes(unitId)) ?? null;
}

interface UnitLike {
  id: string;
  title: string;
  lessons: ReadonlyArray<{ id: string; target: string }>;
}

interface WorldMapOptions {
  units: readonly UnitLike[];
  isComplete: (lessonId: string) => boolean;
  /** The next lesson of the sequential trail; null when everything is done. */
  nextLessonId: string | null;
  /** Adult-guided practice: every lesson is playable. */
  freePractice?: boolean;
}

/**
 * The data behind the "Escolher aventura" screens. Unlocking follows the same
 * rule as "Continuar aventura": done lessons plus the next one.
 */
export function buildWorldMap({ units, isComplete, nextLessonId, freePractice = false }: WorldMapOptions) {
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  return WORLDS.map((world) => {
    const worldUnits = world.unitIds.flatMap((unitId) => {
      const unit = unitsById.get(unitId);
      if (!unit) return [];
      const lessons = unit.lessons.map((lesson) => {
        const state = isComplete(lesson.id) ? 'done' as const : lesson.id === nextLessonId ? 'next' as const : 'locked' as const;
        return { id: lesson.id, target: lesson.target, state, playable: freePractice || state !== 'locked' };
      });
      return [{ id: unit.id, title: unit.title, done: lessons.filter((l) => l.state === 'done').length, lessons }];
    });
    const lessons = worldUnits.flatMap((unit) => unit.lessons);
    return {
      id: world.id,
      title: world.title,
      icon: world.icon,
      description: world.description,
      done: lessons.filter((lesson) => lesson.state === 'done').length,
      total: lessons.length,
      current: lessons.some((lesson) => lesson.id === nextLessonId),
      units: worldUnits,
    };
  });
}
