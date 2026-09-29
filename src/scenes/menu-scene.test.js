import { describe, it, expect, vi } from 'vitest';
import { MenuScene, describeLesson } from './menu-scene.js';
import { Actions } from '../input/actions.js';

function makeFakeGame(overrides = {}) {
  return {
    profiles: {
      listProfiles: vi.fn(() => []),
      getActiveProfile: vi.fn(() => null),
      setActiveProfile: vi.fn(),
      hasParentalConsent: vi.fn(() => false),
      recordParentalConsent: vi.fn(),
      createProfile: vi.fn(() => ({ id: 'p-new', name: 'Nicolas', characterId: 'char-nicolas' })),
      renameProfile: vi.fn(),
      getProfile: vi.fn(() => null),
    },
    progress: {
      getNextLesson: vi.fn(() => null),
      completedCount: vi.fn(() => 0),
      getSpeedrunBestTime: vi.fn(() => null),
    },
    curriculum: {
      lessonOrder: ['alfabeto-a'],
      getLesson: vi.fn((id) => ({ id, target: 'A', objective: 'Encontre A' })),
      lessons: [{ id: 'alfabeto-a' }],
      units: [],
    },
    menu: {
      showPrivacyNotice: vi.fn(),
      showMainMenu: vi.fn(),
      showPhonePairing: vi.fn(),
      hide: vi.fn(),
      isVisible: false,
    },
    input: {
      consumePressed: vi.fn(() => false),
      isActionHeld: vi.fn(() => false),
    },
    renderer: { clear: vi.fn() },
    scenes: { switchTo: vi.fn() },
    phoneControl: {
      isActive: false,
      start: vi.fn(() => ({
        session: 'AB23CD45',
        pairingUrl: 'https://example.test/controle?session=AB23CD45',
        measureLatency: vi.fn(() => Promise.resolve(42)),
      })),
      stop: vi.fn(),
    },
    startSpeedrun: vi.fn(),
    startLesson: vi.fn(),
    startExploration: vi.fn(),
    ...overrides,
  };
}

describe('MenuScene', () => {
  it('shows privacy notice on first run when no profiles exist and no parental consent', () => {
    const game = makeFakeGame();
    const scene = new MenuScene(game);
    scene.render();

    expect(game.menu.showPrivacyNotice).toHaveBeenCalledTimes(1);
    expect(game.profiles.createProfile).not.toHaveBeenCalled();
    expect(game.menu.showMainMenu).not.toHaveBeenCalled();
  });

  it('opens the guardian information from the welcome notice and comes back without consent (docs/22 M11)', () => {
    const game = makeFakeGame();
    game.menu.showGuardianInfo = vi.fn();
    const scene = new MenuScene(game);
    scene.render();

    game.menu.showPrivacyNotice.mock.calls[0][0].onOpenGuardianInfo();
    game.menu.showGuardianInfo.mock.calls[0][0].onBack();

    expect(game.profiles.recordParentalConsent).not.toHaveBeenCalled();
    expect(game.menu.showPrivacyNotice).toHaveBeenCalledTimes(2);
    expect(game.menu.showMainMenu).not.toHaveBeenCalled();
  });

  it('records consent and re-renders when privacy notice is confirmed', () => {
    // Stateful fake: recording consent latches, exactly like the real store.
    let consent = false;
    const game = makeFakeGame({
      profiles: {
        listProfiles: vi.fn(() => []),
        getActiveProfile: vi.fn(() => null),
        setActiveProfile: vi.fn(),
        hasParentalConsent: vi.fn(() => consent),
        recordParentalConsent: vi.fn(() => {
          consent = true;
          return true;
        }),
        createProfile: vi.fn(() => ({ id: 'p-new', name: 'Nicolas', characterId: 'char-nicolas' })),
        renameProfile: vi.fn(),
        getProfile: vi.fn(() => null),
      },
    });
    const scene = new MenuScene(game);
    scene.render();

    const { onConfirm } = game.menu.showPrivacyNotice.mock.calls[0][0];
    onConfirm();

    expect(game.profiles.recordParentalConsent).toHaveBeenCalledTimes(1);
    // After consent, scene re-renders: creates profile and shows main menu
    expect(game.profiles.createProfile).toHaveBeenCalledWith('Nicolas', 'char-nicolas');
    expect(game.menu.showMainMenu).toHaveBeenCalledTimes(1);
  });

  it('creates a default profile and shows main menu when consent was already given', () => {
    const game = makeFakeGame({
      profiles: {
        listProfiles: vi.fn(() => []),
        getActiveProfile: vi.fn(() => null),
        hasParentalConsent: vi.fn(() => true),
        createProfile: vi.fn(() => ({ id: 'p-new', name: 'Nicolas', characterId: 'char-nicolas' })),
      },
    });
    const scene = new MenuScene(game);
    scene.render();

    expect(game.profiles.createProfile).toHaveBeenCalledWith('Nicolas', 'char-nicolas');
    expect(game.menu.showMainMenu).toHaveBeenCalledTimes(1);
  });

  it('uses an existing profile when one is available', () => {
    const existingProfile = { id: 'p1', name: 'Eloá', characterId: 'char-elo' };
    const game = makeFakeGame({
      profiles: {
        listProfiles: vi.fn(() => [existingProfile]),
        getActiveProfile: vi.fn(() => null),
        setActiveProfile: vi.fn(() => existingProfile),
        hasParentalConsent: vi.fn(() => true),
      },
    });
    const scene = new MenuScene(game);
    scene.render();

    expect(game.profiles.setActiveProfile).toHaveBeenCalledWith('p1');
    expect(game.menu.showMainMenu).toHaveBeenCalledTimes(1);
  });

  it('renames a profile with default name "Jogador" to "Nicolas"', () => {
    const profile = { id: 'p1', name: 'Jogador', characterId: 'char-nicolas' };
    const game = makeFakeGame({
      profiles: {
        listProfiles: vi.fn(() => [profile]),
        getActiveProfile: vi.fn(() => profile),
        setActiveProfile: vi.fn(() => profile),
        renameProfile: vi.fn(),
        hasParentalConsent: vi.fn(() => true),
      },
    });
    const scene = new MenuScene(game);
    scene.render();

    expect(game.profiles.renameProfile).toHaveBeenCalledWith('p1', 'Nicolas');
  });

  it('re-renders the main menu when the overlay is not visible on update', () => {
    // Consent already given so render() reaches showMainMenu (no privacy gate).
    const game = makeFakeGame({
      profiles: {
        listProfiles: vi.fn(() => [{ id: 'p1', name: 'Nicolas', characterId: 'char-nicolas' }]),
        getActiveProfile: vi.fn(() => ({ id: 'p1', name: 'Nicolas', characterId: 'char-nicolas' })),
        setActiveProfile: vi.fn(),
        hasParentalConsent: vi.fn(() => true),
        createProfile: vi.fn(),
        renameProfile: vi.fn(),
      },
    });
    const scene = new MenuScene(game);
    scene.update();
    expect(game.menu.showMainMenu).toHaveBeenCalledTimes(1);
  });

  it('forwards CONFIRM and BACK actions when menu is visible', () => {
    const game = makeFakeGame({
      menu: { isVisible: true, triggerPrimary: vi.fn(), triggerBack: vi.fn(), hide: vi.fn() },
      input: {
        consumePressed: vi.fn((action) => {
          if (action === Actions.CONFIRM || action === Actions.BACK) return true;
          return false;
        }),
        isActionHeld: vi.fn(() => false),
      },
    });
    const scene = new MenuScene(game);
    scene.update();

    expect(game.menu.triggerPrimary).toHaveBeenCalledTimes(1);
    expect(game.menu.triggerBack).toHaveBeenCalledTimes(1);
  });

  it('calls startSpeedrun from the speedrun action', () => {
    const game = makeFakeGame();
    const scene = new MenuScene(game);
    scene.startSpeedrun();
    expect(game.startSpeedrun).toHaveBeenCalledTimes(1);
  });

  it('starts the next lesson from playNext', () => {
    const activeProfile = { id: 'p1', name: 'Eloá', characterId: 'char-elo' };
    const game = makeFakeGame({
      profiles: {
        getActiveProfile: vi.fn(() => activeProfile),
        createProfile: vi.fn(),
      },
      progress: {
        getNextLesson: vi.fn(() => 'alfabeto-b'),
      },
    });
    const scene = new MenuScene(game);
    scene.playNext();

    expect(game.startLesson).toHaveBeenCalledWith('alfabeto-b');
  });

  it('starts the Explorar trail for the active profile, creating one if needed', () => {
    const game = makeFakeGame();
    const scene = new MenuScene(game);
    scene.startExplore();

    expect(game.profiles.createProfile).toHaveBeenCalledTimes(1);
    expect(game.startExploration).toHaveBeenCalledTimes(1);
  });

  it('starts a phone pairing session and shows the QR screen with its pairing URL', () => {
    const game = makeFakeGame();
    const scene = new MenuScene(game);
    scene.openPhonePairing();

    expect(game.phoneControl.start).toHaveBeenCalledTimes(1);
    expect(game.menu.showPhonePairing).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'waiting',
        pairingUrl: 'https://example.test/controle?session=AB23CD45',
      }),
    );
  });

  it('re-renders the pairing screen as "paired" once the phone connects', () => {
    const game = makeFakeGame();
    const scene = new MenuScene(game);
    scene.openPhonePairing();

    const { onPaired } = game.phoneControl.start.mock.calls[0][0];
    onPaired();

    expect(game.menu.showPhonePairing).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'paired' }),
    );
  });

  it('stops phone control and returns to the main menu on "Voltar"', () => {
    const game = makeFakeGame({
      profiles: {
        listProfiles: vi.fn(() => [{ id: 'p1', name: 'Nicolas', characterId: 'char-nicolas' }]),
        getActiveProfile: vi.fn(() => ({ id: 'p1', name: 'Nicolas', characterId: 'char-nicolas' })),
        setActiveProfile: vi.fn(),
        hasParentalConsent: vi.fn(() => true),
        createProfile: vi.fn(),
        renameProfile: vi.fn(),
      },
    });
    const scene = new MenuScene(game);
    scene.openPhonePairing();

    const { onBack } = game.menu.showPhonePairing.mock.calls[0][0];
    onBack();

    expect(game.phoneControl.stop).toHaveBeenCalledTimes(1);
    expect(game.menu.showMainMenu).toHaveBeenCalledTimes(1);
  });

  it('passes measureLatency through to the pairing screen', async () => {
    const game = makeFakeGame();
    const scene = new MenuScene(game);
    scene.openPhonePairing();

    const { measureLatency } = game.menu.showPhonePairing.mock.calls[0][0];
    expect(await measureLatency()).toBe(42);
  });

  it('shows a timeout hint if nobody pairs within the waiting window', () => {
    vi.useFakeTimers();
    const game = makeFakeGame();
    const scene = new MenuScene(game);
    scene.openPhonePairing();

    expect(game.menu.showPhonePairing.mock.calls.at(-1)[0].showTimeoutHint).toBe(false);

    vi.advanceTimersByTime(45_000);

    expect(game.menu.showPhonePairing.mock.calls.at(-1)[0].showTimeoutHint).toBe(true);
    vi.useRealTimers();
  });

  it('never shows the timeout hint once the phone has paired', () => {
    vi.useFakeTimers();
    const game = makeFakeGame();
    const scene = new MenuScene(game);
    scene.openPhonePairing();

    const { onPaired } = game.phoneControl.start.mock.calls[0][0];
    onPaired();
    vi.advanceTimersByTime(45_000);

    expect(game.menu.showPhonePairing.mock.calls.at(-1)[0].showTimeoutHint).toBe(false);
    vi.useRealTimers();
  });

  it('stops phone control on entering the menu, so keyboard/touch always work when arriving there', () => {
    const game = makeFakeGame({ phoneControl: { isActive: true, start: vi.fn(), stop: vi.fn() } });
    const scene = new MenuScene(game);

    scene.enter();

    expect(game.phoneControl.stop).toHaveBeenCalledTimes(1);
  });

  it('does not touch phone control on entering the menu when it was never active', () => {
    const game = makeFakeGame();
    const scene = new MenuScene(game);

    scene.enter();

    expect(game.phoneControl.stop).not.toHaveBeenCalled();
  });

  it('hides the menu on exit', () => {
    const game = makeFakeGame();
    const scene = new MenuScene(game);
    scene.exit();
    expect(game.menu.hide).toHaveBeenCalledTimes(1);
  });

  it('draws a sky-blue background', () => {
    const game = makeFakeGame();
    const renderer = { clear: vi.fn() };
    const scene = new MenuScene(game);
    scene.draw(renderer);
    expect(renderer.clear).toHaveBeenCalledTimes(1);
  });
});

describe('describeLesson', () => {
  it('names a letter lesson by its letter, not by a syllable family', () => {
    expect(describeLesson({ type: 'letter', target: 'A', unitTitle: 'Alfabeto' })).toBe('Letra A');
  });

  it('names a word lesson by its word', () => {
    expect(describeLesson({ type: 'word', target: 'SOL', unitTitle: 'Palavras de Uma Sílaba' })).toBe(
      'Palavra SOL',
    );
  });

  it('names syllable families, digraphs and blends by their unit title', () => {
    expect(describeLesson({ type: 'syllable', target: 'BA', unitTitle: 'Família do B' })).toBe(
      'Família do B',
    );
    // The digraph and blend units are also typed "syllable" but must not read
    // as a family.
    expect(describeLesson({ type: 'syllable', target: 'CH', unitTitle: 'Dígrafos' })).toBe('Dígrafos');
    expect(
      describeLesson({ type: 'syllable', target: 'BR', unitTitle: 'Encontros Consonantais' }),
    ).toBe('Encontros Consonantais');
  });

  it('falls back to "Sílabas" when a syllable lesson carries no unit title', () => {
    expect(describeLesson({ type: 'syllable', target: 'PA' })).toBe('Sílabas PA');
  });

  it('falls back to the first unit when there is no lesson yet', () => {
    expect(describeLesson(null)).toBe('Alfabeto');
  });

  it('asks before resetting progress and only resets on explicit confirmation', () => {
    const resetProgress = vi.fn();
    const game = makeFakeGame({
      audio: { musicVolume: 1, sfxVolume: 1, voiceVolume: 1, setCategoryVolume: vi.fn() },
      experience: { read: () => ({ reducedMotion: false }), update: vi.fn() },
    });
    game.progress.resetProgress = resetProgress;
    game.profiles.getActiveProfile = vi.fn(() => ({ id: 'p1' }));
    game.menu.showSettings = vi.fn();
    game.menu.showConfirm = vi.fn();
    const scene = new MenuScene(game);

    scene.openSettings();
    game.menu.showSettings.mock.calls[0][0].onResetProgress();
    expect(resetProgress).not.toHaveBeenCalled();
    const confirm = game.menu.showConfirm.mock.calls[0][0];

    confirm.onCancel();
    expect(resetProgress).not.toHaveBeenCalled();
    expect(game.menu.showSettings).toHaveBeenCalledTimes(2);
    // Cancelar returns to the screen the reset lives on.
    expect(game.menu.showSettings.mock.calls[1][0].section).toBe('help');

    confirm.onConfirm();
    expect(resetProgress).toHaveBeenCalledWith('p1');
  });

  it('offers the controls practice once on the first touch play, then continues to the lesson', () => {
    let state = { offered: false, completed: false };
    const controlsPractice = {
      read: () => state,
      markOffered: vi.fn(() => { state = { ...state, offered: true }; }),
    };
    const game = makeFakeGame({ device: { isTouch: true }, controlsPractice });
    game.menu.showPracticeOffer = vi.fn();
    const scene = new MenuScene(game);

    scene.playNext();
    expect(game.startLesson).not.toHaveBeenCalled();
    const offer = game.menu.showPracticeOffer.mock.calls[0][0];

    offer.onPractice();
    expect(controlsPractice.markOffered).toHaveBeenCalled();
    expect(game.scenes.switchTo).toHaveBeenCalledWith('practice', { onExit: expect.any(Function) });
    game.scenes.switchTo.mock.calls[0][1].onExit();
    expect(game.startLesson).toHaveBeenCalledWith('alfabeto-a');

    scene.playNext();
    expect(game.menu.showPracticeOffer).toHaveBeenCalledTimes(1);
    expect(game.startLesson).toHaveBeenCalledTimes(2);
  });

  it('never offers the practice without touch', () => {
    const game = makeFakeGame({ device: { isTouch: false }, controlsPractice: { read: () => ({ offered: false }) } });
    game.menu.showPracticeOffer = vi.fn();
    new MenuScene(game).startSpeedrun();
    expect(game.menu.showPracticeOffer).not.toHaveBeenCalled();
    expect(game.startSpeedrun).toHaveBeenCalled();
  });

  it('can open straight on Settings when coming back from the practice', () => {
    const game = makeFakeGame({
      audio: { musicVolume: 1, sfxVolume: 1, voiceVolume: 1 },
      experience: { read: () => ({ reducedMotion: false }) },
    });
    game.menu.showSettings = vi.fn();
    new MenuScene(game).enter({ open: 'settings' });
    expect(game.menu.showSettings).toHaveBeenCalled();
    expect(game.menu.showMainMenu).not.toHaveBeenCalled();
  });
});

describe('MenuScene world map (docs/20 §4 L1, docs/22 M07)', () => {
  async function worldGame() {
    const curriculum = await import('../content/curriculum.js');
    const profile = { id: 'p1', name: 'Nicolas', characterId: 'char-nicolas', progress: {} };
    return makeFakeGame({
      profiles: { ...makeFakeGame().profiles, getActiveProfile: vi.fn(() => profile) },
      progress: {
        getNextLesson: vi.fn(() => 'silabas-b-ba'),
        isLessonComplete: vi.fn((_, id) => id.startsWith('alfabeto-')),
        completedCount: vi.fn(() => 26),
        getSpeedrunBestTime: vi.fn(() => null),
      },
      curriculum: { units: curriculum.UNITS, lessons: curriculum.LESSONS, lessonOrder: curriculum.LESSON_ORDER, getLesson: curriculum.getLesson },
      menu: { ...makeFakeGame().menu, showWorldList: vi.fn(), showWorldDetail: vi.fn(), showUnitLessons: vi.fn() },
    });
  }

  it('reaches a lesson through world, unit and lesson, and goes back one level at a time', async () => {
    const game = await worldGame();
    const scene = new MenuScene(game);

    scene.openWorldMap();
    const { worlds, onOpenWorld } = game.menu.showWorldList.mock.calls[0][0];
    expect(worlds.find((world) => world.current).id).toBe('pomar-das-silabas');

    onOpenWorld('pomar-das-silabas');
    const { world, onOpenUnit, onBack: backToWorlds } = game.menu.showWorldDetail.mock.calls[0][0];
    expect(world.units[0].lessons[0]).toMatchObject({ id: 'silabas-b-ba', state: 'next' });

    onOpenUnit('silabas-b');
    const lessons = game.menu.showUnitLessons.mock.calls[0][0];
    expect(lessons.unit.id).toBe('silabas-b');
    expect(lessons.backLabel).toBe('Voltar às partes');

    lessons.onToggleFreePractice();
    const freed = game.menu.showUnitLessons.mock.calls[1][0];
    expect(freed.freePractice).toBe(true);
    expect(freed.unit.lessons.every((lesson) => lesson.playable)).toBe(true);

    freed.onBack();
    expect(game.menu.showWorldDetail).toHaveBeenCalledTimes(2);
    backToWorlds();
    expect(game.menu.showWorldList).toHaveBeenCalledTimes(2);

    freed.onPlayLesson('silabas-b-ba');
    expect(game.startLesson).toHaveBeenCalledWith('silabas-b-ba');
  });

  it('opens a one-unit world (the alphabet) straight on its lessons', async () => {
    const game = await worldGame();
    const scene = new MenuScene(game);

    scene.openWorld('jardim-das-letras');
    expect(game.menu.showWorldDetail).not.toHaveBeenCalled();
    const lessons = game.menu.showUnitLessons.mock.calls[0][0];
    expect(lessons.unit.id).toBe('alfabeto');
    expect(lessons.backLabel).toBe('Voltar aos mundos');
    lessons.onBack();
    expect(game.menu.showWorldList).toHaveBeenCalledTimes(1);
  });
});

describe('MenuScene Configurações tree (docs/22 §4)', () => {
  function settingsGame(overrides = {}) {
    const game = makeFakeGame({
      audio: { musicVolume: 1, sfxVolume: 1, voiceVolume: 1, setCategoryVolume: vi.fn() },
      experience: { read: () => ({ reducedMotion: false, supportLevel: 'standard' }), update: vi.fn() },
      ...overrides,
    });
    game.profiles.hasParentalConsent = vi.fn(() => true);
    game.menu.showSettings = vi.fn();
    game.menu.showGuardianInfo = vi.fn();
    game.menu.showInstallGuide = vi.fn();
    return game;
  }
  const lastSettings = (game) => game.menu.showSettings.mock.calls.at(-1)[0];

  it('opens the hub, moves to a section and back, and re-shows the same section after a change', () => {
    const game = settingsGame();
    const scene = new MenuScene(game);
    scene.openSettings();
    expect(lastSettings(game).section).toBeUndefined();

    lastSettings(game).onOpenSection('audio');
    expect(lastSettings(game).section).toBe('audio');

    lastSettings(game).onAudioChange('music', 0.4);
    expect(game.audio.setCategoryVolume).toHaveBeenCalledWith('music', 0.4);
    expect(lastSettings(game).section).toBe('audio');

    lastSettings(game).onOpenSection(null);
    expect(lastSettings(game).section).toBeUndefined();
    lastSettings(game).onBack();
    expect(game.menu.showMainMenu).toHaveBeenCalled();
  });

  it('returns from the install guide to Aplicativo and from the guardian page to Ajuda e dados', () => {
    const game = settingsGame();
    const scene = new MenuScene(game);
    scene.openSettings('app');
    lastSettings(game).onOpenInstallGuide();
    game.menu.showInstallGuide.mock.calls[0][0].onBack();
    expect(lastSettings(game).section).toBe('app');

    scene.openSettings('help');
    lastSettings(game).onOpenGuardianInfo();
    game.menu.showGuardianInfo.mock.calls[0][0].onBack();
    expect(lastSettings(game).section).toBe('help');
  });

  it('comes back from the practice opened in Controles to Controles', () => {
    const game = settingsGame({ device: { isTouch: true }, touchLayout: { read: () => ({ size: 'default', jumpSide: 'right', edgeInset: 'near' }), update: vi.fn(), reset: vi.fn() } });
    const scene = new MenuScene(game);
    scene.openSettings('controls');
    lastSettings(game).touch.onPractice();
    const { onExit } = game.scenes.switchTo.mock.calls[0][1];
    onExit();
    expect(game.scenes.switchTo).toHaveBeenLastCalledWith('menu', { open: 'settings', section: 'controls' });

    new MenuScene(game).enter({ open: 'settings', section: 'controls' });
    expect(lastSettings(game).section).toBe('controls');
  });

  it('restores only the touch layout', () => {
    const touchLayout = { read: () => ({ size: 'large', jumpSide: 'left', edgeInset: 'far' }), update: vi.fn(), reset: vi.fn() };
    const game = settingsGame({ device: { isTouch: true }, touchLayout });
    game.progress.resetProgress = vi.fn();
    const scene = new MenuScene(game);
    scene.openSettings('touch');
    lastSettings(game).touch.onReset();
    expect(touchLayout.reset).toHaveBeenCalled();
    expect(game.audio.setCategoryVolume).not.toHaveBeenCalled();
    expect(game.progress.resetProgress).not.toHaveBeenCalled();
    expect(lastSettings(game).section).toBe('touch');
  });
});
