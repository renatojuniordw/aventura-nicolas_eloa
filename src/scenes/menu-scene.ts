import { Scene } from '../core/scene.js';
import { Actions } from '../input/actions.js';
import { COLORS } from '../core/config.js';
import type { CanvasRenderer } from '../render/canvas-renderer.js';

interface LessonLike {
  type?: string;
  target?: string;
  unitTitle?: string;
}

/**
 * Short label for the "next discovery" card.
 *
 * The noun has to follow the lesson kind: on the alphabet unit the target is a
 * single letter, and on the word units it is a whole word, so a fixed "Família"
 * prefix read as "Família A" and "Família SOL". Syllable families, digraphs and
 * blends are already named by their unit ("Família do B", "Dígrafos").
 */
export function describeLesson(lesson: LessonLike | null | undefined): string {
  if (!lesson) return 'Alfabeto';
  const { type, target, unitTitle } = lesson;
  if (type === 'word') return `Palavra ${target}`;
  if (type === 'letter') return `Letra ${target}`;
  return unitTitle ?? `Sílabas ${target}`;
}

/**
 * Main menu: pick a player, pick a character, start the next lesson or choose
 * a specific phase. All interaction goes through the overlay, and the keyboard
 * shortcuts are the abstracted CONFIRM/BACK actions.
 */
export class MenuScene extends Scene {
  override enter(): void {
    this.render();
  }

  override exit(): void {
    this.game.menu.hide();
  }

  render(): void {
    const { profiles, progress, menu } = this.game;
    let activeProfile = profiles.getActiveProfile();
    if (!activeProfile) {
      const existing = profiles.listProfiles()[0];
      if (existing) {
        profiles.setActiveProfile(existing.id);
        activeProfile = existing;
      } else if (!profiles.hasParentalConsent()) {
        // First run: the responsible adult must confirm the privacy notice
        // before any child profile is created.
        menu.showPrivacyNotice({
          onConfirm: () => {
            profiles.recordParentalConsent();
            this.render();
          },
        });
        return;
      } else {
        activeProfile = profiles.createProfile('Nicolas', 'char-nicolas');
      }
    }
    if (activeProfile && (activeProfile.name === 'Jogador' || !activeProfile.name)) {
      profiles.renameProfile(activeProfile.id, 'Nicolas');
      activeProfile = profiles.getActiveProfile();
    }

    const { lessonOrder, getLesson } = this.game.curriculum;
    const nextLessonId = activeProfile
      ? (progress.getNextLesson(activeProfile.id, lessonOrder) ?? lessonOrder[0])
      : lessonOrder[0];
    const nextLesson = getLesson(nextLessonId);
    const discoveryTitle = describeLesson(nextLesson);

    menu.showMainMenu({
      profiles: profiles.listProfiles(),
      activeProfileId: activeProfile?.id ?? null,
      selectedCharacterId: activeProfile?.characterId ?? 'char-nicolas',
      completedCount: activeProfile ? progress.completedCount(activeProfile.id) : 0,
      totalLessons: this.game.curriculum.lessons.length,
      currentLessonTitle: discoveryTitle,
      speedrunBestTime: activeProfile ? progress.getSpeedrunBestTime(activeProfile.id) : null,
      onPlay: () => this.playNext(),
      onSpeedrun: () => this.startSpeedrun(),
      onSelectProfile: (profileId: string) => {
        profiles.setActiveProfile(profileId);
        this.render();
      },
      onSelectCharacter: (characterId: string) => {
        const profile = profiles.getActiveProfile();
        if (profile) profiles.setCharacter(profile.id, characterId);
        this.render();
      },
      onOpenCharacterPicker: (characterId: string) => this.openCharacterPicker(characterId),
      onOpenLessonPicker: () => this.openLessonPicker(),
      onOpenPhonePairing: () => this.openPhonePairing(),
      onResetProgress: () => {
        const profile = profiles.getActiveProfile();
        if (profile) progress.resetProgress(profile.id);
        this.render();
      },
    });
  }

  startSpeedrun(): void {
    this.game.startSpeedrun();
  }

  /** Start the first unfinished lesson, creating a profile if needed. */
  playNext(): void {
    const profile =
      this.game.profiles.getActiveProfile() ??
      this.game.profiles.createProfile('Nicolas', 'char-nicolas');
    const { lessonOrder } = this.game.curriculum;
    const nextLessonId =
      this.game.progress.getNextLesson(profile.id, lessonOrder) ?? lessonOrder[0];
    this.game.startLesson(nextLessonId);
  }

  openCharacterPicker(initialCharacterId: string): void {
    let selectedId = initialCharacterId;

    const open = (): void => {
      this.game.menu.showCharacterPicker({
        selectedId,
        onSelect: (characterId: string) => {
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

  /** Controle por celular (docs/12-controle-por-celular.md §6): shows the QR
   * pairing screen and re-renders it as the phone joins/drops. */
  openPhonePairing(): void {
    let status: 'waiting' | 'paired' | 'disconnected' | 'error' = 'waiting';
    let errorMessage: string | null = null;
    let pairingUrl = '';

    const renderPairing = () => {
      this.game.menu.showPhonePairing({
        pairingUrl,
        status,
        errorMessage,
        onBack: () => {
          this.game.phoneControl.stop();
          this.render();
        },
        onPlay: () => this.playNext(),
      });
    };

    const result = this.game.phoneControl.start({
      onPaired: () => {
        status = 'paired';
        renderPairing();
      },
      onDisconnected: () => {
        status = 'disconnected';
        renderPairing();
      },
      onError: (message) => {
        status = 'error';
        errorMessage = message;
        renderPairing();
      },
    });
    pairingUrl = result.pairingUrl;
    renderPairing();
  }

  openLessonPicker(): void {
    const profile = this.game.profiles.getActiveProfile();
    const unlocked = new Set(
      profile
        ? this.game.progress.getUnlockedLessonIds(profile.id, this.game.curriculum.lessonOrder)
        : [],
    );

    this.game.menu.showLessonPicker({
      units: this.game.curriculum.units,
      isUnlocked: (lessonId: string) => unlocked.has(lessonId),
      onPick: (lessonId: string) => this.game.startLesson(lessonId),
      onBack: () => this.render(),
    });
  }

  override update(): void {
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

  override draw(renderer: CanvasRenderer): void {
    renderer.clear(COLORS.sky);
  }
}
