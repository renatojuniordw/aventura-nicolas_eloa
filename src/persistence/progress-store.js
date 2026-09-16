import { Events } from '../core/event-bus.js';
import { clampStars } from './migration.js';

/**
 * Per-profile progress: which lessons are done, their best result and the
 * cumulative hit/miss stats.
 *
 * Lessons unlock sequentially, mirroring the reference game: you always have
 * the completed ones plus the next one to play.
 */

/** Fewer mistakes means more stars (0 -> 3, 1 -> 2, 2+ -> 1). */
export function starsForMistakes(mistakes) {
  if (mistakes <= 0) return 3;
  if (mistakes === 1) return 2;
  return 1;
}

export class ProgressStore {
  constructor({ saves, bus = null, now = () => Date.now() }) {
    this._saves = saves;
    this._bus = bus;
    this._now = now;
  }

  getLessonProgress(profileId, lessonId) {
    const profile = this._saves.read().profiles[profileId];
    return profile?.progress?.[lessonId] ?? null;
  }

  isLessonComplete(profileId, lessonId) {
    return Boolean(this.getLessonProgress(profileId, lessonId)?.completed);
  }

  completedCount(profileId) {
    const profile = this._saves.read().profiles[profileId];
    if (!profile) return 0;
    return Object.values(profile.progress).filter((entry) => entry.completed).length;
  }

  /** Records a correct/wrong answer for the profile statistics. */
  recordAnswer(profileId, isCorrect) {
    this._saves.update((doc) => {
      const profile = doc.profiles[profileId];
      if (!profile) return;
      if (isCorrect) profile.stats.correct += 1;
      else profile.stats.wrong += 1;
    });
  }

  /**
   * Marks a lesson as finished, keeping the best result achieved so far.
   * @returns {object|null} the stored entry
   */
  completeLesson(profileId, lessonId, { mistakes = 0 } = {}) {
    const entry = this._saves.update((doc) => {
      const profile = doc.profiles[profileId];
      if (!profile) return null;

      const stars = starsForMistakes(mistakes);
      const previous = profile.progress[lessonId];
      const stored = {
        completed: true,
        stars: previous ? Math.max(clampStars(previous.stars), stars) : stars,
        mistakes: previous ? Math.min(previous.mistakes ?? mistakes, mistakes) : mistakes,
        updatedAt: this._now(),
      };
      profile.progress[lessonId] = stored;
      return stored;
    });

    if (entry) {
      this._bus?.emit(Events.PROGRESS_SAVED, { profileId, lessonId, entry });
    }
    return entry;
  }

  resetProgress(profileId) {
    return this._saves.update((doc) => {
      const profile = doc.profiles[profileId];
      if (!profile) return null;
      profile.progress = {};
      profile.stats = { correct: 0, wrong: 0 };
      delete profile.speedrunBestTime;
      return profile;
    });
  }

  getSpeedrunBestTime(profileId) {
    const profile = this._saves.read().profiles[profileId];
    return profile?.speedrunBestTime ?? null;
  }

  recordSpeedrunTime(profileId, timeSeconds) {
    return this._saves.update((doc) => {
      const profile = doc.profiles[profileId];
      if (!profile) return null;
      const prev = profile.speedrunBestTime;
      const isNewBest = prev == null || timeSeconds < prev;
      if (isNewBest) {
        profile.speedrunBestTime = timeSeconds;
      }
      return { bestTime: profile.speedrunBestTime, isNewBest };
    });
  }

  /**
   * Lessons the profile may play: everything completed, plus the first one
   * still pending (so progress continues where it stopped).
   */
  getUnlockedLessonIds(profileId, orderedLessonIds) {
    const unlocked = [];
    for (const lessonId of orderedLessonIds) {
      unlocked.push(lessonId);
      if (!this.isLessonComplete(profileId, lessonId)) break;
    }
    return unlocked;
  }

  /** The next lesson to play, or null when everything is complete. */
  getNextLesson(profileId, orderedLessonIds) {
    return orderedLessonIds.find((lessonId) => !this.isLessonComplete(profileId, lessonId)) ?? null;
  }
}
