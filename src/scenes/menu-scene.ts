import { discoveredWords } from '../content/discoveries.js';
import { buildWorldMap } from '../content/worlds.js';
import { wordPhaseId } from '../content/word-phases.js';
import { Actions } from '../input/actions.js';
import { Scene } from '../core/scene.js';
import { COLORS } from '../core/config.js';
import { DEFAULT_CHARACTER_ID, getCharacter } from '../content/characters.js';
import { pumpMenuKeys } from '../ui/overlay-input.js';
import { DEFAULT_PLAYER_NAME, resolveActiveProfile } from '../persistence/active-profile.js';
import type { CanvasRenderer } from '../render/canvas-renderer.js';
import { formatSupportReport, readSupportEnvironment } from '../ui/support-info.js';

interface MenuParams {
  /** Screen to open instead of the home (e.g. coming back from the controls practice). */
  open?: 'settings';
}

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
  override enter(params: MenuParams = {}): void {
    // Arriving at the menu from anywhere (finishing a lesson, pausing out,
    // the phone dropping) must always leave keyboard/touch working — phone
    // mode replaces that composite entirely (see main.ts), and nothing else
    // ever restored it. Re-pairing for the next lesson is one QR scan away;
    // a menu with a dead keyboard is not an acceptable trade for skipping it.
    if (this.game.phoneControl.isActive) this.game.phoneControl.stop();
    if (params.open === 'settings') this.openSettings();
    else this.render();
  }

  override exit(): void {
    this._freePractice = false;
    this.game.narrator?.stop();
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
      completedCount: activeProfile ? progress.completedCount(activeProfile.id, lessonOrder) : 0,
      totalLessons: this.game.curriculum.lessons.length,
      currentLessonTitle: discoveryTitle,
      speedrunBestTime: activeProfile ? progress.getSpeedrunBestTime(activeProfile.id) : null,
      onPlay: () => this.playNext(),
      onExplore: () => this.startExplore(),
      onOpenDiscoveries: () => this.openDiscoveries(),
      onOpenWorldMap: () => this.openWorldMap(),
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
      onOpenSettings: () => this.openSettings(),
      motion: this.game.motion,
    });
  }

  /** Adult-guided free practice on the world map; lasts until the menu is left. */
  private _freePractice = false;

  /** The world map for the active profile (docs/20 §4 L1). */
  private _worldMap() {
    const { progress, curriculum, profiles } = this.game;
    const profile = profiles.getActiveProfile();
    return buildWorldMap({
      units: curriculum.units,
      isComplete: (lessonId) => Boolean(profile && progress.isLessonComplete(profile.id, lessonId)),
      nextLessonId: profile ? progress.getNextLesson(profile.id, curriculum.lessonOrder) : curriculum.lessonOrder[0] ?? null,
      freePractice: this._freePractice,
    });
  }

  /** "Escolher aventura": worlds, then a world's lessons — a lesson is three choices from the home. */
  openWorldMap(): void {
    this.game.menu.showWorldList({
      worlds: this._worldMap(),
      onOpenWorld: (worldId) => this.openWorld(worldId),
      onBack: () => this.render(),
    });
  }

  openWorld(worldId: string): void {
    const world = this._worldMap().find((entry) => entry.id === worldId);
    if (!world) {
      this.openWorldMap();
      return;
    }
    this.game.menu.showWorldDetail({
      world,
      freePractice: this._freePractice,
      onPlayLesson: (lessonId) => this.playLesson(lessonId),
      onToggleFreePractice: () => {
        this._freePractice = !this._freePractice;
        this.openWorld(worldId);
      },
      onBack: () => this.openWorldMap(),
    });
  }

  /** Plays a chosen lesson (a replay never erases its stored best result). */
  playLesson(lessonId: string): void {
    this._withPracticeOffer(() => {
      this.game.profiles.getActiveProfile() ??
        this.game.profiles.createProfile(DEFAULT_PLAYER_NAME, DEFAULT_CHARACTER_ID);
      this.game.startLesson(lessonId);
    });
  }

  openDiscoveries(): void {
    const profile = this.game.profiles.getActiveProfile();
    this.game.menu.showDiscoveries({
      playerName: profile?.name ?? DEFAULT_PLAYER_NAME,
      words: discoveredWords(profile).map(word => ({
        word, completed: Boolean(profile?.progress[wordPhaseId(word.id)]?.completed),
      })),
      onListen: word => this.game.narrator?.speak(`${word.label.toLowerCase()}. ${word.fact}`),
      onReplay: word => { this.game.narrator?.stop(); this.game.startExploration(word.id); },
      onExplore: () => this.startExplore(),
      onBack: () => { this.game.narrator?.stop(); this.render(); },
    });
  }

  /**
   * First touch play on this device: offer the controls practice once before
   * starting (docs/18 §8). Either answer is remembered; the practice then
   * continues into what the child had chosen.
   */
  private _withPracticeOffer(start: () => void): void {
    const store = this.game.controlsPractice;
    if (!this.game.device?.isTouch || !store || store.read().offered) {
      start();
      return;
    }
    this.game.menu.showPracticeOffer({
      onPractice: () => {
        store.markOffered();
        this.openPractice(start);
      },
      onSkip: () => {
        store.markOffered();
        start();
      },
    });
  }

  /** "Experimentar controles": the safe practice arena, then `onExit`. */
  openPractice(onExit: () => void = () => this.game.scenes.switchTo('menu', { open: 'settings' })): void {
    this.game.scenes.switchTo('practice', { onExit });
  }

  /** Start the next unfinished Explorar word, creating a profile if needed. */
  startExplore(): void {
    this._withPracticeOffer(() => {
      this.game.profiles.getActiveProfile() ??
        this.game.profiles.createProfile(DEFAULT_PLAYER_NAME, DEFAULT_CHARACTER_ID);
      this.game.startExploration();
    });
  }

  startSpeedrun(): void {
    this._withPracticeOffer(() => this.game.startSpeedrun());
  }

  /** Start the first unfinished lesson, creating a profile if needed. */
  playNext(): void {
    this._withPracticeOffer(() => this._startNextLesson());
  }

  private _startNextLesson(): void {
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
      audio: {
        musicVolume: this.game.audio.musicVolume,
        sfxVolume: this.game.audio.sfxVolume,
        voiceVolume: this.game.audio.voiceVolume,
      },
      experience: this.game.experience.read(),
      systemReducedMotion: Boolean(this.game.motion?.reduced()) && !this.game.experience.read().reducedMotion,
      onAudioChange: (category, value) => {
        this.game.audio.setCategoryVolume(category, value);
        this.openSettings();
      },
      onExperienceChange: (patch) => {
        this.game.experience.update(patch);
        this.openSettings();
      },
      onOpenInstallGuide: () => this.game.menu.showInstallGuide({ onBack: () => this.openSettings() }),
      touch: this.game.device?.isTouch && this.game.touchLayout
        ? {
            layout: this.game.touchLayout.read(),
            onChange: (patch) => {
              this.game.touchLayout.update(patch);
              this.openSettings();
            },
            onReset: () => {
              this.game.touchLayout.reset();
              this.openSettings();
            },
            onPractice: () => this.openPractice(),
          }
        : undefined,
      onOpenSupport: () => this.openSupportInfo(),
      onOpenPhonePairing: () => this.openPhonePairing(),
      onResetProgress: () =>
        this.game.menu.showConfirm({
          title: 'Zerar progresso?',
          message: 'As fases, o caderno de descobertas e os recordes deste jogador serão apagados deste aparelho. Isso não pode ser desfeito.',
          confirmLabel: 'Sim, zerar',
          onConfirm: () => {
            const profile = profiles.getActiveProfile();
            if (profile) progress.resetProgress(profile.id);
            this.render();
          },
          onCancel: () => this.openSettings(),
        }),
      onBack: () => this.render(),
    });
  }

  /** "Informações para suporte" (docs/18 §10): read on open/refresh only, copied only on request. */
  openSupportInfo(): void {
    const { frameStats } = this.game;
    const report = formatSupportReport(
      readSupportEnvironment({
        reducedMotion: this.game.preferences.reducedMotion(),
        touchLayout: this.game.touchLayout.read(),
        frames: frameStats.summary(),
      }),
    );
    this.game.menu.showSupportInfo({
      report,
      measuring: frameStats.running,
      onToggleMeasuring: () => {
        if (frameStats.running) frameStats.stop();
        else frameStats.start();
        this.openSupportInfo();
      },
      onRefresh: () => this.openSupportInfo(),
      onBack: () => this.openSettings(),
      copy: async (text) => {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          return false;
        }
      },
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
        // The phone is the controller here: no on-screen controls practice offer.
        onPlay: () => {
          clearTimeout(timeoutId);
          this._startNextLesson();
        },
        onSpeedrun: () => {
          clearTimeout(timeoutId);
          this.game.startSpeedrun();
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
