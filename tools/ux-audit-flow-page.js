/*
 * Page side of tools/ux-audit.mjs for the real navigation (docs/23 §5 item 2):
 * evaluated inside the running game with a fresh profile, each step performs a
 * real action through the visible button (not a builder with inert callbacks)
 * and names the state reached, which the runner then measures. Covers first
 * run, the world map levels, every Configurações screen and its return, the
 * Caderno, the phone pairing screen, a real match with its HUD and pause, and
 * the way back to the menu. A button that cannot be found is a failure.
 */
(() => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const roots = () => [...document.querySelectorAll('#overlay-root, #hud-controls-root, .orientation-warning')];
  // Portrait on a touch device: the match waits behind the orientation warning (docs/22 M18).
  const needsLandscape = () => document.body.classList.contains('needs-landscape');
  const SKIP = { skip: true };
  const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.disabled && !el.closest('[inert]');
  const buttons = () => roots().flatMap((root) => [...root.querySelectorAll('button')]).filter(visible);
  const label = (el) => `${el.getAttribute('aria-label') ?? ''} ${el.textContent ?? ''}`.replace(/\s+/g, ' ').trim().toLowerCase();

  /** Clicks the first visible button whose label contains `text`, paging forward when the screen is paginated. */
  async function click(text, { optional = false } = {}) {
    const wanted = text.toLowerCase();
    for (let page = 0; page < 12; page += 1) {
      const target = buttons().find((b) => label(b).includes(wanted));
      if (target) {
        target.click();
        await sleep(300);
        return true;
      }
      const next = buttons().find((b) => label(b) === 'próxima' || label(b).startsWith('próxima') || b.getAttribute('aria-label')?.toLowerCase().startsWith('próxima'));
      if (!next || next.getAttribute('aria-disabled') === 'true') break;
      next.click();
      await sleep(150);
    }
    if (optional) return false;
    throw new Error(`botão "${text}" não encontrado`);
  }
  const clickSelector = async (selector) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`${selector} não encontrado`);
    el.click();
    await sleep(300);
  };
  const back = () => click('voltar');

  const SETTINGS = [['Som e narração', 'audio'], ['Apoio para jogar', 'support'], ['Acessibilidade', 'access'], ['Controles', 'controls'], ['Aplicativo', 'app'], ['Ajuda e dados', 'help']];

  const steps = [
    ['real-first-screen', async () => {
      for (let i = 0; i < 40 && !document.querySelector('#overlay-root button'); i += 1) await sleep(100);
      document.getElementById('splash-screen')?.remove();
    }],
    ['real-home', async () => {
      await click('entendi, pode começar', { optional: true });
      await click('agora não', { optional: true });
    }],
    ['real-world-list', () => click('escolher aventura')],
    ['real-world-open', () => clickSelector('#overlay-root .world-card')],
    ['real-world-list-back', back],
    ['real-home-back', back],
    ['real-settings', () => click('configurações')],
    ...SETTINGS.flatMap(([text, id]) => [
      [`real-settings-${id}`, () => click(text)],
      [`real-settings-${id}-back`, back],
    ]),
    ['real-settings-controls-again', () => click('controles')],
    ['real-pairing', () => click('usar outro celular')],
    ['real-pairing-back', back],
    ['real-settings-hub-back', back],
    ['real-home-from-settings', back],
    ['real-discoveries', () => click('caderno de descobertas')],
    ['real-home-from-discoveries', back],
    ['real-game', async () => {
      await clickSelector('#overlay-root [data-nav-id="play"]');
      await click('já sei, vamos brincar', { optional: true });
      await sleep(1200);
    }],
    // Landscape: the HUD pause and its confirmation. Portrait: the warning's own way out.
    ['real-pause', () => (needsLandscape() ? SKIP : click('pausar'))],
    ['real-pause-confirm-menu', () => (needsLandscape() ? SKIP : click('menu'))],
    ['real-home-after-game', () => (needsLandscape() ? click('voltar ao menu') : click('sim, confirmar'))],
  ];

  window.__uxAudit = {
    async list({ largeText, textScale = 1 } = {}) {
      if (largeText) document.documentElement.dataset.textSize = 'large';
      if (textScale > 1) document.documentElement.style.fontSize = `${textScale * 100}%`;
      return steps.map(([name]) => name);
    },
    async show(name) {
      const step = steps.find(([stepName]) => stepName === name);
      try {
        const result = await step[1]();
        return result === SKIP ? SKIP : null;
      } catch (error) {
        return String(error.message ?? error);
      }
    },
  };
})();
