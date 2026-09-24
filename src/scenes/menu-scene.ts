import { Actions } from '../input/actions.js';
import { Scene } from '../core/scene.js';
import { COLORS } from '../core/config.js';
import { DEFAULT_CHARACTER_ID, getCharacter } from '../content/characters.js';
import { pumpMenuKeys } from '../ui/overlay-input.js';
import { DEFAULT_PLAYER_NAME, resolveActiveProfile } from '../persistence/active-profile.js';
import type { CanvasRenderer } from '../render/canvas-renderer.js';

/** How long the QR pairing screen waits before nudging toward "Voltar" (docs/12 §10). */
const PAIRING_TIMEOUT_HINT_MS = 45_000;

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
    // Arriving at the menu from anywhere (finishing a lesson, pausing out,
    // the phone dropping) must always leave keyboard/touch working — phone
    // mode replaces that composite entirely (see main.ts), and nothing else
    // ever restored it. Re-pairing for the next lesson is one QR scan away;
    // a menu with a dead keyboard is not an acceptable trade for skipping it.
    if (this.game.phoneControl.isActive) this.game.phoneControl.stop();
    this.render();
  }

  override exit(): void {
    this.game.menu.hide();
  }

  render(): void {
    const { profiles, progress, menu } = this.game;
    const resolved = resolveActiveProfile(profiles);
    if (resolved.status === 'needs-consent') {
      // First run: the responsible adult must confirm the privacy notice
      // before any child profile is created.
      menu.showPrivacyNotice({
        onConfirm: () => {
          profiles.recordParentalConsent();
          this.render();
        },
      });
      return;
    }
    if (menu.offerFullscreen?.({ onDone: () => this.render() })) return;
    const activeProfile = resolved.profile;

    const { lessonOrder, getLesson } = this.game.curriculum;
    const nextLessonId = activeProfile
      ? (progress.getNextLesson(activeProfile.id, lessonOrder) ?? lessonOrder[0])
      : lessonOrder[0];
    const nextLesson = getLesson(nextLessonId);
    const discoveryTitle = describeLesson(nextLesson);

    menu.showMainMenu({
      profiles: profiles.listProfiles(),
      activeProfileId: activeProfile?.id ?? null,
      selectedCharacterId: activeProfile?.characterId ?? DEFAULT_CHARACTER_ID,
      completedCount: activeProfile ? progress.completedCount(activeProfile.id) : 0,
      totalLessons: this.game.curriculum.lessons.length,
      currentLessonTitle: discoveryTitle,
      speedrunBestTime: activeProfile ? progress.getSpeedrunBestTime(activeProfile.id) : null,
      onPlay: () => this.playNext(),
      onExplore: () => this.game.startExploration(),
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
      onOpenSettings: () => this.openSettings(),
    });
  }

  startSpeedrun(): void {
    this.game.startSpeedrun();
  }

  /** Start the first unfinished lesson, creating a profile if needed. */
  playNext(): void {
    const profile =
      this.game.profiles.getActiveProfile() ??
      this.game.profiles.createProfile(DEFAULT_PLAYER_NAME, DEFAULT_CHARACTER_ID);
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
          const char = getCharacter(selectedId);
          const activeProfile = this.game.profiles.getActiveProfile();

          if (activeProfile && activeProfile.characterId === selectedId) {
            this.render();
            return;
          }

          const allProfiles = this.game.profiles.listProfiles();
          let targetProfile = allProfiles.find((p) => p.characterId === selectedId);

          if (!targetProfile) {
            const defaultName = char.name.split(' ')[0];
            targetProfile = this.game.profiles.createProfile(defaultName, selectedId);
          }

          this.game.profiles.setActiveProfile(targetProfile.id);
          this.render();
        },
        onBack: () => this.render(),
      });
    };

    open();
  }

  /** Settings screen: houses the phone-pairing entry point and progress reset,
   * so future config options have a home without crowding the main menu. */
  openSettings(): void {
    const { profiles, progress } = this.game;
    this.game.menu.showSettings({
      onOpenPhonePairing: () => this.openPhonePairing(),
      onResetProgress: () => {
        const profile = profiles.getActiveProfile();
        if (profile) progress.resetProgress(profile.id);
        this.render();
      },
      onBack: () => this.render(),
    });
  }

  /** Controle por celular (docs/12-controle-por-celular.md §6): shows the QR
   * pairing screen and re-renders it as the phone joins/drops. */
  openPhonePairing(): void {
    let status: 'waiting' | 'paired' | 'disconnected' | 'error' = 'waiting';
    let errorMessage: string | null = null;
    let pairingUrl = '';
    let showTimeoutHint = false;
    let measureLatency: () => Promise<number | null> = () => Promise.resolve(null);

    // If nobody ever scans the QR (camera didn't open, sensor permission
    // denied on the phone...), the screen must not just wait forever with no
    // way out — nudge toward the "Voltar" button that was already there
    // (docs/12 §10: "precisa de um caminho de saída de volta pro controle
    // padrão").
    const timeoutId = setTimeout(() => {
      if (status !== 'waiting') return;
      showTimeoutHint = true;
      renderPairing();
    }, PAIRING_TIMEOUT_HINT_MS);

    const renderPairing = () => {
      this.game.menu.showPhonePairing({
        pairingUrl,
        status,
        errorMessage,
        showTimeoutHint: showTimeoutHint && status === 'waiting',
        measureLatency: () => measureLatency(),
        onBack: () => {
          clearTimeout(timeoutId);
          this.game.phoneControl.stop();
          this.render();
        },
        onPlay: () => {
          clearTimeout(timeoutId);
          this.playNext();
        },
        onSpeedrun: () => {
          clearTimeout(timeoutId);
          this.startSpeedrun();
        },
      });
    };

    const result = this.game.phoneControl.start({
      onPaired: () => {
        clearTimeout(timeoutId);
        status = 'paired';
        renderPairing();
      },
      onDisconnected: () => {
        status = 'disconnected';
        renderPairing();
      },
      onError: (message) => {
        clearTimeout(timeoutId);
        status = 'error';
        errorMessage = message;
        renderPairing();
      },
    });
    measureLatency = result.measureLatency;
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
    if (this.game.input.consumePressed(Actions.PAUSE)) this.game.menu.triggerBack();
    pumpMenuKeys(this.game);
  }

  override draw(renderer: CanvasRenderer): void {
    renderer.clear(COLORS.sky);
  }
}
