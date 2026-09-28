import { buildDiscoveriesScreen } from './screens/discoveries.js';
import { buildFullscreenOffer } from './screens/fullscreen-offer.js';
import { isFullscreenSupported, isFullscreen } from './fullscreen.js';
import { isStandalone } from './pwa-install.js';
import { clear } from './dom.js';
import { buildMainMenuScreen } from './screens/main-menu.js';
import { buildCharacterPickerScreen } from './screens/character-picker.js';
import { buildPauseScreen, type PauseStep } from './screens/pause.js';
import { buildGameOverScreen } from './screens/game-over.js';
import { buildVictoryScreen, buildSpeedrunVictoryScreen, buildExploreVictoryScreen } from './screens/victory.js';
import { buildPrivacyNoticeScreen } from './screens/privacy-notice.js';
import { buildPhonePairingScreen } from './screens/phone-pairing.js';
import { buildSettingsScreen } from './screens/settings-v2.js';
import { buildInstallGuide } from './screens/install-guide.js';
import { buildConfirmScreen } from './screens/confirm.js';
import { buildSupportInfoScreen } from './screens/support-info.js';
import { buildPracticeOfferScreen } from './screens/practice-offer.js';
import { buildWorldDetailScreen, buildWorldListScreen } from './screens/world-map.js';
import {
  captureScroll,
  findByNavId,
  focusablesIn,
  initialFocusOf,
  navIdOf,
  restoreScroll,
  type NavContext,
} from './navigation-context.js';

interface ScreenResult {
  node: HTMLElement;
  primary?: (() => void) | null;
  back?: (() => void) | null;
  cleanup?: (() => void) | null;
}

interface MenuOverlayOptions {
  root: HTMLElement;
}

/** How a screen is mounted: its navigation key and whether it is a modal dialog. */
interface ScreenKind {
  key: string;
  /** Modal screens get dialog semantics and keep Tab inside; the home is a page, not a dialog. */
  modal: boolean;
}

/** Outside elements that stay reachable from a modal (essential notices). */
const MODAL_EXTRAS = '.update-banner';

/**
 * DOM overlay screens: main menu, character picker, phase picker, pause, game
 * over and victory. All copy is in Brazilian Portuguese.
 *
 * Screens are click-driven AND keyboard-driven: each mounted screen registers a
 * primary and a back action, which the scenes trigger from the abstracted
 * CONFIRM/BACK actions. So menus obey the same input abstraction as gameplay.
 *
 * This class only mounts/unmounts screens and wires their primary/back
 * actions; each screen's DOM and copy live in its own module under
 * `ui/screens/` (React components today), so growing or reskinning one
 * screen never touches the rest. `cleanup` (always `root.unmount()` for a
 * React screen) is what tears down the previous screen's React root when a
 * new one mounts — every `showX` here must forward it, or the mounted
 * React root leaks and any of its effects (timers, rAF loops) keep running
 * detached from the DOM.
 *
 * Navigation context (docs/18 §5): every screen has a key. Leaving a screen
 * remembers which control was last used and how far it was scrolled; coming
 * back to a screen still on that trail (Settings → Home, Install → Settings,
 * a screen re-rendering itself) restores both. A screen opened fresh focuses
 * its declared `data-autofocus` control, or its first control. `hide()`
 * (back to the game) forgets the trail.
 */
export class MenuOverlay {
  private _root: HTMLElement;
  private _visible = false;
  private _fullscreenOffered = false;
  private _primary: (() => void) | null = null;
  private _back: (() => void) | null = null;
  private _cleanup: (() => void) | null = null;
  private _current: ScreenKind | null = null;
  /** Screens left on the way here, oldest first, with what to restore. */
  private _trail: Array<{ key: string; context: NavContext }> = [];
  private _lastNavId: string | null = null;

  constructor({ root }: MenuOverlayOptions) {
    this._root = root;
    const remember = (event: Event) => {
      const id = navIdOf(event.target as Element | null);
      if (id) this._lastNavId = id;
    };
    root.addEventListener('focusin', remember);
    // Touch taps on iOS do not focus buttons, so the activation itself counts.
    root.addEventListener('click', remember, true);
    if (typeof document !== 'undefined') document.addEventListener('focusin', (event) => this._containFocus(event));
  }

  get isVisible(): boolean {
    return this._visible;
  }

  hide(): void {
    this._cleanup?.();
    this._cleanup = null;
    clear(this._root);
    this._visible = false;
    this._setGameplayControlsInert(false);
    this._primary = null;
    this._back = null;
    this._current = null;
    this._trail = [];
    this._lastNavId = null;
    document.getElementById('game-canvas')?.focus({ preventScroll: true });
  }

  /**
   * Keeps focus inside a modal screen (plus essential notices) without reading
   * keys — keyboard listeners belong to the input layer. When focus lands
   * outside, it wraps: leaving past the last control returns to the first,
   * leaving before the first goes to the last.
   */
  private _containFocus(event: FocusEvent): void {
    if (!this._visible || !this._current?.modal) return;
    const target = event.target as HTMLElement | null;
    if (!target || this._root.contains(target) || target.closest(MODAL_EXTRAS)) return;
    const inside = focusablesIn(this._root);
    if (!inside.length) return;
    const from = event.relatedTarget as HTMLElement | null;
    const next = from === inside[0] ? inside[inside.length - 1]! : inside[0]!;
    next.focus({ preventScroll: true });
  }

  private _setGameplayControlsInert(inert: boolean): void {
    for (const id of ['hud-controls-root', 'touch-controls-root']) {
      const controls = document.getElementById(id);
      if (controls && controls !== this._root) controls.inert = inert;
    }
  }

  triggerPrimary(): void {
    this._primary?.();
  }

  triggerBack(): void {
    this._back?.();
  }

  private _mount(
    node: HTMLElement,
    { primary = null, back = null, cleanup = null }: Omit<ScreenResult, 'node'>,
    kind: ScreenKind,
  ): void {
    // Remember the screen being left, then work out whether this is a return.
    if (this._current) {
      const context: NavContext = { focusId: this._lastNavId, scroll: captureScroll(this._root) };
      this._trail = this._trail.filter((entry) => entry.key !== this._current!.key);
      this._trail.push({ key: this._current.key, context });
    }
    const at = this._trail.findIndex((entry) => entry.key === kind.key);
    const restore = at === -1 ? null : this._trail[at]!.context;
    if (at !== -1) this._trail = this._trail.slice(0, at);

    this._cleanup?.();
    this._cleanup = cleanup ?? null;
    clear(this._root);
    this._root.append(node);
    this._primary = primary ?? null;
    this._back = back ?? null;
    this._visible = true;
    this._current = kind;
    this._lastNavId = null;
    this._setGameplayControlsInert(true);
    if (kind.modal) this._markDialog(node);

    if (restore) restoreScroll(this._root, restore.scroll);
    const target = findByNavId(node, restore?.focusId ?? null) ?? initialFocusOf(node);
    target?.focus({ preventScroll: true });
    this._lastNavId = target ? navIdOf(target) : null;
  }

  /** Dialog semantics on the screen's own panel, named by its first heading. */
  private _markDialog(node: HTMLElement): void {
    const panel = node.firstElementChild as HTMLElement | null;
    if (!panel || panel.hasAttribute('role')) return;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    const heading = panel.querySelector<HTMLElement>('h1, h2');
    if (heading) {
      heading.id ||= `overlay-title-${Math.random().toString(36).slice(2, 8)}`;
      panel.setAttribute('aria-labelledby', heading.id);
    }
  }

  /** Builds a screen from its options and mounts it with the actions it returned. */
  private _show<Options>(
    build: (options: Options) => ScreenResult,
    options: Options,
    kind: ScreenKind,
  ): void {
    const { node, ...actions } = build(options);
    this._mount(node, actions, kind);
  }

  offerFullscreen(options: { onDone: () => void }): boolean {
    if (this._fullscreenOffered || !isFullscreenSupported() || isFullscreen() || isStandalone()) return false;
    this._fullscreenOffered = true;
    this._show(buildFullscreenOffer, options, { key: 'fullscreen-offer', modal: true });
    return true;
  }

  // --- Screens -------------------------------------------------------------

  showDiscoveries(options: Parameters<typeof buildDiscoveriesScreen>[0]): void {
    this._show(buildDiscoveriesScreen, options, { key: 'discoveries', modal: false });
  }

  showMainMenu(options: Parameters<typeof buildMainMenuScreen>[0]): void {
    this._show(buildMainMenuScreen, options, { key: 'main-menu', modal: false });
  }

  /** "Escolher aventura": the worlds (docs/20 §4 L1). */
  showWorldList(options: Parameters<typeof buildWorldListScreen>[0]): void {
    this._show(buildWorldListScreen, options, { key: 'world-list', modal: false });
  }

  /** One world's units and lessons. */
  showWorldDetail(options: Parameters<typeof buildWorldDetailScreen>[0]): void {
    this._show(buildWorldDetailScreen, options, { key: 'world-detail', modal: false });
  }

  showCharacterPicker(options: Parameters<typeof buildCharacterPickerScreen>[0]): void {
    this._show(buildCharacterPickerScreen, options, { key: 'character-picker', modal: true });
  }

  showPause(options: Parameters<typeof buildPauseScreen>[1]): void {
    this._renderPauseScreen('menu', options);
  }

  private _renderPauseScreen(step: PauseStep, options: Parameters<typeof buildPauseScreen>[1]): void {
    const goTo = (nextStep: PauseStep) => this._renderPauseScreen(nextStep, options);
    this._show((screenOptions) => buildPauseScreen(step, screenOptions, goTo), options, {
      key: step === 'menu' ? 'pause' : 'pause-confirm',
      modal: true,
    });
  }

  showGameOver(options: Parameters<typeof buildGameOverScreen>[0]): void {
    this._show(buildGameOverScreen, options, { key: 'game-over', modal: true });
  }

  showVictory(options: Parameters<typeof buildVictoryScreen>[0]): void {
    this._show(buildVictoryScreen, options, { key: 'victory', modal: true });
  }

  showSpeedrunVictory(options: Parameters<typeof buildSpeedrunVictoryScreen>[0]): void {
    this._show(buildSpeedrunVictoryScreen, options, { key: 'victory', modal: true });
  }

  showExploreVictory(options: Parameters<typeof buildExploreVictoryScreen>[0]): void {
    this._show(buildExploreVictoryScreen, options, { key: 'victory', modal: true });
  }

  showPrivacyNotice(options: Parameters<typeof buildPrivacyNoticeScreen>[0]): void {
    this._show(buildPrivacyNoticeScreen, options, { key: 'privacy-notice', modal: true });
  }

  showPhonePairing(options: Parameters<typeof buildPhonePairingScreen>[0]): void {
    this._show(buildPhonePairingScreen, options, { key: 'phone-pairing', modal: true });
  }

  showSettings(options: Parameters<typeof buildSettingsScreen>[0]): void {
    this._show(buildSettingsScreen, options, { key: 'settings', modal: true });
  }

  showInstallGuide(options: Parameters<typeof buildInstallGuide>[0]): void {
    this._show(buildInstallGuide, options, { key: 'install-guide', modal: true });
  }

  showPracticeOffer(options: Parameters<typeof buildPracticeOfferScreen>[0]): void {
    this._show(buildPracticeOfferScreen, options, { key: 'practice-offer', modal: true });
  }

  showSupportInfo(options: Parameters<typeof buildSupportInfoScreen>[0]): void {
    this._show(buildSupportInfoScreen, options, { key: 'support-info', modal: true });
  }

  /** A destructive-action confirmation: Cancelar is the start focus and the keyboard default. */
  showConfirm(options: Parameters<typeof buildConfirmScreen>[0]): void {
    this._show(buildConfirmScreen, options, { key: 'confirm', modal: true });
  }
}
