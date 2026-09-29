/*
 * Page side of tools/ux-audit.mjs: evaluated inside the running game (Vite dev
 * server), it mounts each screen with the game's own builders into the real
 * overlay/HUD roots, with inert callbacks and sample data. Screens that need
 * gameplay to be reached (victory, pause, coach) are covered the same way.
 */
(() => {
  const noop = () => {};
  let modules = null;
  let overlay = null;
  let hud = null;

  async function load() {
    if (modules) return modules;
    const [menu, hudControls, words] = await Promise.all([
      import('/src/ui/menu.ts'),
      import('/src/ui/hud-controls.tsx'),
      import('/src/content/word-bank.ts'),
    ]);
    document.getElementById('splash-screen')?.remove();
    document.querySelector('.orientation-warning')?.remove();
    const root = document.getElementById('overlay-root');
    overlay = new menu.MenuOverlay({ root });
    hud = new hudControls.HudControls({ root: document.getElementById('hud-controls-root') });
    modules = { words: words.WORD_BANK };
    return modules;
  }

  const lessons = (count, next) => Array.from({ length: count }, (_, i) => ({
    id: `l${i}`, target: String.fromCharCode(65 + (i % 26)),
    state: i < next ? 'done' : i === next ? 'next' : 'locked', playable: i <= next,
  }));
  const units = (count, size) => Array.from({ length: count }, (_, i) => ({
    id: `u${i}`, title: `Família do ${String.fromCharCode(66 + i)}`, done: i === 0 ? 2 : 0, lessons: lessons(size, i === 0 ? 2 : -1),
  }));
  const worlds = () => [
    ['jardim', 'Jardim das Letras', '🌷', 'O alfabeto de A a Z', units(1, 26)],
    ['pomar', 'Pomar das Sílabas', '🍎', 'As famílias silábicas', units(11, 5)],
    ['vale', 'Vale dos Desafios', '⛰️', 'Dígrafos e encontros de consoantes', units(2, 6)],
    ['lago', 'Lago das Palavras', '🌊', 'Palavras curtas de uma e duas sílabas', units(2, 8)],
    ['bosque', 'Bosque das Descobertas', '🌳', 'Palavras por tema: animais, alimentos, casa, brinquedos, família, cozinha e corpo', units(7, 6)],
  ].map(([id, title, icon, description, worldUnits], i) => ({
    id, title, icon, description, done: i === 0 ? 26 : i === 1 ? 2 : 0,
    total: worldUnits.reduce((sum, unit) => sum + unit.lessons.length, 0), current: i === 1, units: worldUnits,
  }));

  const settings = (extra = {}) => ({
    audio: { musicVolume: 0.6, sfxVolume: 1, voiceVolume: 0.85 },
    experience: { supportLevel: 'assisted', highContrast: false, reducedMotion: false, largeText: false, colorVision: 'default' },
    onAudioChange: noop, onExperienceChange: noop, onOpenInstallGuide: noop, onOpenPhonePairing: noop,
    onResetProgress: noop, onBack: noop, onOpenSupport: noop, onOpenGuardianInfo: noop,
    touch: { layout: { size: 'large', jumpSide: 'right', edgeInset: 'far' }, onChange: noop, onReset: noop, onPractice: noop },
    ...extra,
  });

  const report = [
    'Versão: 0.4.0 (abc1234, 2026-09-28)', 'Navegador: Chrome 140 · Android 15', 'Tela: 412×915 CSS px · DPR 2.625',
    'Orientação: retrato', 'Instalado: não', 'Toque: sim (5 pontos)', 'Movimento reduzido: não',
    'Controles: Maior, À direita, Longe', 'Fluidez: 60 fps médios, p95 18 ms (1200 quadros)',
  ].join('\n');

  const screens = {
    'privacy': () => overlay.showPrivacyNotice({ onConfirm: noop, onOpenGuardianInfo: noop }),
    'guardian-info': () => overlay.showGuardianInfo?.({ onBack: noop }),
    // Mounted in `show` (the builder is not exposed by MenuOverlay).
    'fullscreen-offer': noop,
    'home': () => overlay.showMainMenu({
      profiles: [{ id: 'p1', name: 'Nicolas', characterId: 'char-nicolas' }], activeProfileId: 'p1', selectedCharacterId: 'char-nicolas',
      completedCount: 28, totalLessons: 150, currentLessonTitle: 'Família do B', speedrunBestTime: 95.4,
      onPlay: noop, onExplore: noop, onOpenDiscoveries: noop, onOpenWorldMap: noop, onSpeedrun: noop, onOpenCharacterPicker: noop, onOpenSettings: noop,
    }),
    'character-picker': () => overlay.showCharacterPicker({ selectedId: 'char-nicolas', onSelect: noop, onConfirm: noop, onBack: noop }),
    'settings': () => overlay.showSettings(settings()),
    'settings-audio': () => overlay.showSettings(settings({ section: 'audio' })),
    'settings-support': () => overlay.showSettings(settings({ section: 'support' })),
    'settings-access': () => overlay.showSettings(settings({ section: 'access' })),
    'settings-controls': () => overlay.showSettings(settings({ section: 'controls' })),
    'settings-touch': () => overlay.showSettings(settings({ section: 'touch' })),
    'settings-app': () => overlay.showSettings(settings({ section: 'app' })),
    'settings-help': () => overlay.showSettings(settings({ section: 'help' })),
    'install-guide': () => overlay.showInstallGuide({ onBack: noop }),
    'support-info': () => overlay.showSupportInfo({ report, measuring: false, onToggleMeasuring: noop, onRefresh: noop, onBack: noop, copy: async () => false }),
    'pairing-waiting': () => overlay.showPhonePairing({ pairingUrl: 'https://example.invalid/controle.html#s=abc123', status: 'waiting', showTimeoutHint: true, measureLatency: async () => 42, onBack: noop, onPlay: noop, onSpeedrun: noop }),
    'pairing-paired': () => overlay.showPhonePairing({ pairingUrl: 'https://example.invalid/controle.html#s=abc123', status: 'paired', measureLatency: async () => 180, onBack: noop, onPlay: noop, onSpeedrun: noop }),
    'practice-offer': () => overlay.showPracticeOffer({ onPractice: noop, onSkip: noop }),
    'confirm': () => overlay.showConfirm({ title: 'Zerar progresso?', message: 'As fases, o caderno de descobertas, o histórico de respostas e o recorde da corrida deste jogador serão apagados deste aparelho. Isso não pode ser desfeito.', confirmLabel: 'Sim, zerar', onConfirm: noop, onCancel: noop }),
    'pause': () => overlay.showPause({ onResume: noop, onRestart: noop, onMenu: noop, onToggleMute: noop, isPhoneControlActive: true, onDisablePhoneControl: noop }),
    'game-over': () => overlay.showGameOver({ lesson: { objective: 'Pegue as letras da palavra BOLA na ordem certa' }, onRetry: noop, onMenu: noop }),
    'victory': () => overlay.showVictory({ lesson: { target: 'BA' }, character: null, stars: 2, mistakes: 1, hasNext: true, onNext: noop, onReplay: noop, onMenu: noop }),
    'speedrun-victory': () => overlay.showSpeedrunVictory({ elapsed: 88.2, mistakes: 3, isNewBest: true, bestTime: 88.2, onReplay: noop, onMenu: noop }),
    'explore-victory': () => overlay.showExploreVictory({ word: 'BORBOLETA', illustration: modules.words[0], journeyWords: modules.words.slice(0, 2), fact: 'A borboleta começa a vida como lagarta e depois ganha asas coloridas.', stars: 3, mistakes: 0, hasNext: true, onNext: noop, onReplay: noop, onMenu: noop }),
    'journey-complete': () => overlay.showExploreVictory({ word: 'BOLA', journeyWords: modules.words.slice(0, 3), journeyComplete: true, stars: 3, mistakes: 0, hasNext: true, onNext: noop, onReplay: noop, onMenu: noop }),
    'discoveries-empty': () => overlay.showDiscoveries({ playerName: 'Eloá', words: [], onListen: noop, onReplay: noop, onExplore: noop, onBack: noop, onOpenWord: noop }),
    'discoveries-one': () => overlay.showDiscoveries({ playerName: 'Eloá', words: [{ word: modules.words[0], completed: true }], onListen: noop, onReplay: noop, onExplore: noop, onBack: noop, onOpenWord: noop }),
    'discoveries-many': () => overlay.showDiscoveries({ playerName: 'Eloá', words: modules.words.slice(0, 23).map((word, i) => ({ word, completed: i % 3 !== 0 })), onListen: noop, onReplay: noop, onExplore: noop, onBack: noop, onOpenWord: noop }),
    'discovery-detail': () => overlay.showDiscoveryDetail?.({ word: modules.words.find((w) => w.fact.length > 60) ?? modules.words[0], completed: true, onListen: noop, onReplay: noop, onBack: noop }),
    'world-list': () => overlay.showWorldList({ worlds: worlds(), onOpenWorld: noop, onBack: noop }),
    'world-detail': () => overlay.showWorldDetail({ world: worlds()[1], freePractice: false, onOpenUnit: noop, onPlayLesson: noop, onToggleFreePractice: noop, onBack: noop }),
    'unit-lessons': () => overlay.showUnitLessons?.({ world: worlds()[0], unit: worlds()[0].units[0], freePractice: false, onPlayLesson: noop, onToggleFreePractice: noop, onBack: noop }),
    'coach-step': () => { overlay.hide(); hud.showPracticeCoach({ stepNumber: 2, totalSteps: 4, title: 'Pule!', body: 'Toque no botão amarelo para pular por cima da pedra.', done: false, onSkip: noop, onRepeat: noop, onFinish: noop }); },
    'coach-done': () => { overlay.hide(); hud.showPracticeCoach({ stepNumber: 4, totalSteps: 4, title: 'Muito bem!', body: 'Você já sabe andar e pular. Vamos brincar?', done: true, onSkip: noop, onRepeat: noop, onFinish: noop }); },
  };

  window.__uxAudit = {
    async list({ largeText, textScale = 1, highContrast = false } = {}) {
      if (highContrast) document.documentElement.dataset.contrast = 'high';
      await load();
      if (largeText) document.documentElement.dataset.textSize = 'large';
      if (textScale > 1) document.documentElement.style.fontSize = `${textScale * 100}%`;
      return Object.keys(screens);
    },
    async show(name) {
      await load();
      hud.hidePauseButton();
      document.body.dataset.scene = name.startsWith('coach') ? 'game' : 'menu';
      if (name === 'fullscreen-offer') {
        const { buildFullscreenOffer } = await import('/src/ui/screens/fullscreen-offer.tsx');
        overlay._show(buildFullscreenOffer, { onDone: noop }, { key: 'fullscreen-offer', modal: true });
        return;
      }
      screens[name]();
    },
  };
})();
