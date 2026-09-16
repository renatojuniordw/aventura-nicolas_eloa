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
      hide: vi.fn(),
      isVisible: false,
    },
    input: {
      consumePressed: vi.fn(() => false),
      isActionHeld: vi.fn(() => false),
    },
    renderer: { clear: vi.fn() },
    scenes: { switchTo: vi.fn() },
    startSpeedrun: vi.fn(),
    startLesson: vi.fn(),
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
});