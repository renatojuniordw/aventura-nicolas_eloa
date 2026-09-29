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
import type { SettingsSection } from '../ui/screens/settings-v2.js';

interface MenuParams {
  /** Screen to open instead of the home (e.g. coming back from the controls practice). */
  open?: 'settings';
  /** Which Configurações screen to open with `open: 'settings'` (the hub when absent). */
  section?: SettingsSection;
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
    // the phone dropping) must always leave keyboard/touch working, but the
    // pairing itself survives (docs/19 §4 P1.2): remote jumps are ignored
    // here and the next match re-engages the same phone without a new QR.
    this.game.phoneControl.disengage();
    if (params.open === 'settings') this.openSettings(params.section);
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
        // Reading the details and coming back is not consent: render() shows the notice again.
        onOpenGuardianInfo: () => menu.showGuardianInfo({ onBack: () => this.render() }),
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

  /** "Escolher aventura": worlds, then a world's units, then a unit's lessons (docs/22 M07). */
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
    // A one-unit world (the alphabet) goes straight to its lessons.
    if (world.units.length === 1) {
      this.openUnit(worldId, world.units[0]!.id);
      return;
    }
    this.game.menu.showWorldDetail({
      world,
      onOpenUnit: (unitId) => this.openUnit(worldId, unitId),
      onBack: () => this.openWorldMap(),
    });
  }

  openUnit(worldId: string, unitId: string): void {
    const world = this._worldMap().find((entry) => entry.id === worldId);
    const unit = world?.units.find((entry) => entry.id === unitId);
    if (!world || !unit) {
      this.openWorldMap();
      return;
    }
    const single = world.units.length === 1;
    this.game.menu.showUnitLessons({
      world,
      unit,
      freePractice: this._freePractice,
      onPlayLesson: (lessonId) => this.playLesson(lessonId),
      onToggleFreePractice: () => {
        this._freePractice = !this._freePractice;
        this.openUnit(worldId, unitId);
      },
      backLabel: single ? 'Voltar aos mundos' : 'Voltar às partes',
      onBack: () => (single ? this.openWorldMap() : this.openWorld(worldId)),
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
    const stop = () => this.game.narrator?.stop();
    this.game.menu.showDiscoveries({
      playerName: profile?.name ?? DEFAULT_PLAYER_NAME,
      words: discoveredWords(profile).map(word => ({
        word, completed: Boolean(profile?.progress[wordPhaseId(word.id)]?.completed),
      })),
      onOpenWord: ({ word, completed }) => this.game.menu.showDiscoveryDetail({
        word,
        completed,
        onListen: entry => this.game.narrator?.speak(`${entry.label.toLowerCase()}. ${entry.fact}`),
        onReplay: entry => { stop(); this.game.startExploration(entry.id); },
        onBack: () => { stop(); this.openDiscoveries(); },
      }),
      onExplore: () => this.startExplore(),
      onBack: () => { stop(); this.render(); },
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
  openPractice(onExit: () => void = () => this.game.scenes.switchTo('menu', { open: 'settings', section: 'controls' })): void {
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

  /**
   * Configurações (docs/22 §4): the hub or one of its screens. Every change
   * is applied and stored at once, then the same screen is shown again (the
   * navigation context keeps focus and page).
   */
  openSettings(section?: SettingsSection | null): void {
    const { profiles, progress } = this.game;
    const reopen = () => this.openSettings(section);
    this.game.menu.showSettings({
      section: section ?? undefined,
      onOpenSection: (next) => this.openSettings(next),
      audio: {
        musicVolume: this.game.audio.musicVolume,
        sfxVolume: this.game.audio.sfxVolume,
        voiceVolume: this.game.audio.voiceVolume,
      },
      experience: this.game.experience.read(),
      systemReducedMotion: Boolean(this.game.motion?.reduced()) && !this.game.experience.read().reducedMotion,
      onAudioChange: (category, value) => {
        this.game.audio.setCategoryVolume(category, value);
        reopen();
      },
      onExperienceChange: (patch) => {
        this.game.experience.update(patch);
        reopen();
      },
      onOpenInstallGuide: () => this.game.menu.showInstallGuide({ onBack: () => this.openSettings('app') }),
      touchVisibility: this.game.touchLayout
        ? {
            value: this.game.touchLayout.read().visibility,
            onChange: (visibility) => {
              this.game.touchLayout.update({ visibility });
              reopen();
            },
          }
        : undefined,
      touch: this.game.device?.isTouch && this.game.touchLayout
        ? {
            layout: this.game.touchLayout.read(),
            onChange: (patch) => {
              this.game.touchLayout.update(patch);
              reopen();
            },
            // Restores only the touch layout: audio, preferences and progress are untouched.
            onReset: () => {
              this.game.touchLayout.reset();
              reopen();
            },
            onPractice: () => this.openPractice(),
          }
        : undefined,
      onOpenSupport: () => this.openSupportInfo(),
      onOpenGuardianInfo: () => this.game.menu.showGuardianInfo({ onBack: () => this.openSettings('help') }),
      onOpenPhonePairing: () => this.openPhonePairing(() => this.openSettings('controls')),
      onResetProgress: () =>
        this.game.menu.showConfirm({
          title: 'Zerar progresso?',
          // Exactly what ProgressStore.resetProgress clears; the name and the settings stay.
          message: 'As fases, o caderno de descobertas, o histórico de respostas e o recorde da corrida deste jogador serão apagados deste aparelho. O nome e as configurações continuam. Isso não pode ser desfeito.',
          confirmLabel: 'Sim, zerar',
          onConfirm: () => {
            const profile = profiles.getActiveProfile();
            if (profile) progress.resetProgress(profile.id);
            this.render();
          },
          onCancel: () => this.openSettings('help'),
        }),
      onBack: () => this.render(),
    });
  }

  /** "Informações para suporte" (docs/18 §10): read on open/refresh only, copied only on request. */
  openSupportInfo(): void {
    const { frameStats } = this.game;
    let report = formatSupportReport(
      readSupportEnvironment({
        reducedMotion: this.game.preferences.reducedMotion(),
        touchLayout: this.game.touchLayout.read(),
        frames: frameStats.summary(),
      }),
    );
    // Phone-control events of this run and the one before a reload (docs/19 §4 P0.1), only when it was used.
    const diagnostics = this.game.phoneDiagnostics;
    const usedPhone = [diagnostics?.current, diagnostics?.previous].some((run) => run?.events.some((event) => event.type === 'join-sent'));
    if (diagnostics && usedPhone) report += `\n\n${diagnostics.formatReport('Controle por celular — diagnóstico da conexão')}`;
    this.game.menu.showSupportInfo({
      report,
      measuring: frameStats.running,
      onToggleMeasuring: () => {
        if (frameStats.running) frameStats.stop();
        else frameStats.start();
        this.openSupportInfo();
      },
      onRefresh: () => this.openSupportInfo(),
      onBack: () => this.openSettings('help'),
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

  /**
   * Controle por celular (docs/12 §6, docs/19 §4 P1.2): shows the QR for a new
   * session, or the live status of the one already paired — reopening this
   * screen never creates a second session behind the adult's back.
   */
  openPhonePairing(onLeave: () => void = () => this.render()): void {
    const phone = this.game.phoneControl;
    let showTimeoutHint = false;
    let endedMessage: string | null = null;
    let offStatus: () => void = () => {};

    const pairing = phone.pairing ?? phone.start();

    // If nobody ever scans the QR (camera didn't open, sensor permission
    // denied on the phone...), the screen must not just wait forever with no
    // way out — nudge toward the "Voltar" button that was already there
    // (docs/12 §10: "precisa de um caminho de saída de volta pro controle
    // padrão").
    const timeoutId = setTimeout(() => {
      if (phone.status.reason !== 'waiting-phone') return;
      showTimeoutHint = true;
      renderPairing();
    }, PAIRING_TIMEOUT_HINT_MS);

    const leave = (next: () => void) => {
      clearTimeout(timeoutId);
      offStatus();
      next();
    };

    const renderPairing = () => {
      const status = phone.status;
      const screenStatus = endedMessage
        ? 'error'
        : !status.paired
          ? 'waiting'
          : status.operational
            ? 'paired'
            : 'disconnected';
      this.game.menu.showPhonePairing({
        pairingUrl: pairing.pairingUrl,
        status: screenStatus,
        statusMessage: endedMessage ?? status.message,
        errorMessage: endedMessage,
        showTimeoutHint: showTimeoutHint && screenStatus === 'waiting',
        measureLatency: pairing.measureLatency,
        onBack: () =>
          leave(() => {
            // A QR nobody scanned is abandoned; a paired phone stays paired.
            if (!phone.isActive) phone.stop();
            onLeave();
          }),
        onDisconnect: phone.isActive
          ? () =>
              leave(() => {
                phone.stop();
                onLeave();
              })
          : undefined,
        onNewCode: endedMessage
          ? () =>
              leave(() => {
                phone.stop();
                this.openPhonePairing(onLeave);
              })
          : undefined,
        // The phone is the controller here: no on-screen controls practice offer.
        onPlay: () => leave(() => this._startNextLesson()),
        onSpeedrun: () => leave(() => this.game.startSpeedrun()),
      });
    };

    offStatus = phone.onStatusChange((status) => {
      if (status.reason === 'ended') endedMessage = status.message;
      // `off` right after `ended` is the coordinator cleaning up: keep the explanation on screen.
      if (status.reason === 'off' && endedMessage) return;
      renderPairing();
    });
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
