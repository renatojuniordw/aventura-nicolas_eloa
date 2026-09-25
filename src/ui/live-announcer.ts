/**
 * Mirrors what the canvas shows (objective, answer feedback) into a polite
 * ARIA live region, so a screen reader hears it too. Repeated text is
 * dropped: the scene may call this every time something *might* have
 * changed without the reader repeating itself every frame.
 */
export class LiveAnnouncer {
  private _el: HTMLElement | null = null;
  private _last = '';

  constructor(doc: Document | null = typeof document !== 'undefined' ? document : null) {
    if (!doc?.body) return;
    const el = doc.createElement('div');
    el.className = 'sr-only';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.dataset.testid = 'live-announcer';
    doc.body.append(el);
    this._el = el;
  }

  /** The last text announced. */
  get text(): string {
    return this._last;
  }

  announce(text: string): void {
    const clean = text.trim();
    if (!clean || clean === this._last) return;
    this._last = clean;
    if (this._el) this._el.textContent = clean;
  }

  /** Forgets the last text, so the same objective is announced again in a new run. */
  reset(): void {
    this._last = '';
    if (this._el) this._el.textContent = '';
  }
}
