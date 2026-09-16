import { Scene } from '../core/scene.js';
import { Actions } from '../input/actions.js';
import { COLORS } from '../core/config.js';

/**
 * Main menu: pick a player, pick a character, start the next lesson or choose
 * a specific phase. All interaction goes through the overlay, and the keyboard
 * shortcuts are the abstracted CONFIRM/BACK actions.
 */
export class MenuScene extends Scene {
  enter() {
    this.render();
  }

  exit() {
    this.game.menu.hide();
  }

  render() {
    const { profiles, progress, menu } = this.game;
    const activeProfile = profiles.getActiveProfile();
    const { lessonOrder, getLesson } = this.game.curriculum;
    const nextLessonId = activeProfile
      ? (progress.getNextLesson(activeProfile.id, lessonOrder) ?? lessonOrder[0])
      : lessonOrder[0];
    const nextLesson = getLesson(nextLessonId);
    const discoveryTitle = nextLesson
      ? (nextLesson.target ? `Família ${nextLesson.target}` : (nextLesson.title ?? 'Família B'))
      : 'Família B';

    menu.showMainMenu({
      profiles: profiles.listProfiles(),
      activeProfileId: activeProfile?.id ?? null,
      selectedCharacterId: activeProfile?.characterId ?? null,
      completedCount: activeProfile ? progress.completedCount(activeProfile.id) : 0,
      totalLessons: this.game.curriculum.lessons.length,
      currentLessonTitle: discoveryTitle,
      onPlay: () => this.playNext(),
      onSelectProfile: (profileId) => {
        profiles.setActiveProfile(profileId);
        this.render();
      },
      onCreateProfile: (name) => {
        profiles.createProfile(name);
        this.render();
      },
      onSelectCharacter: (characterId) => {
        const profile = profiles.getActiveProfile();
        if (profile) profiles.setCharacter(profile.id, characterId);
        this.render();
      },
      onOpenCharacterPicker: (characterId) => this.openCharacterPicker(characterId),
      onOpenLessonPicker: () => this.openLessonPicker(),
      onResetProgress: () => {
        const profile = profiles.getActiveProfile();
        if (profile) progress.resetProgress(profile.id);
        this.render();
      },
    });
  }

  /** Start the first unfinished lesson, creating a profile if needed. */
  playNext() {
    const profile = this.game.profiles.getActiveProfile() ?? this.game.profiles.createProfile('Jogador');
    const { lessonOrder } = this.game.curriculum;
    const nextLessonId =
      this.game.progress.getNextLesson(profile.id, lessonOrder) ?? lessonOrder[0];
    this.game.startLesson(nextLessonId);
  }

  openCharacterPicker(initialCharacterId) {
    let selectedId = initialCharacterId;

    const open = () => {
      this.game.menu.showCharacterPicker({
        selectedId,
        onSelect: (characterId) => {
          selectedId = characterId;
          open();
        },
        onConfirm: () => {
          const profile = this.game.profiles.getActiveProfile();
          if (profile) this.game.profiles.setCharacter(profile.id, selectedId);
          this.render();
        },
        onBack: () => this.render(),
      });
    };

    open();
  }

  openLessonPicker() {
    const profile = this.game.profiles.getActiveProfile();
    const unlocked = new Set(
      profile
        ? this.game.progress.getUnlockedLessonIds(profile.id, this.game.curriculum.lessonOrder)
        : [],
    );

    this.game.menu.showLessonPicker({
      units: this.game.curriculum.units,
      isUnlocked: (lessonId) => unlocked.has(lessonId),
      onPick: (lessonId) => this.game.startLesson(lessonId),
      onBack: () => this.render(),
    });
  }

  update() {
    if (!this.game.menu.isVisible) {
      this.render();
      return;
    }
    if (this.game.input.consumePressed(Actions.CONFIRM)) {
      this.game.menu.triggerPrimary();
    }
    if (this.game.input.consumePressed(Actions.BACK)) {
      this.game.menu.triggerBack();
    }
  }

  draw(renderer) {
    renderer.clear(COLORS.sky);
  }
}
