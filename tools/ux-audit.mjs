#!/usr/bin/env node
/**
 * Visual/geometry audit (docs/22 §10, docs/23 §5), in a real browser.
 *
 * Starts headless Chrome, opens the running dev server (`npm run dev`) and,
 * for every viewport of the matrix, audits three targets:
 *   - menus:    each menu screen mounted through the game's own builders with
 *               sample data (tools/ux-audit-page.js);
 *   - controle: every state of the phone-controller page, drawn by its own view
 *               (tools/ux-audit-controle-page.js, docs/22 M20);
 *   - flow:     the real game with a fresh profile, driven through its visible
 *               buttons — first run, world map, every Configurações screen and
 *               its return, Caderno, pairing, a match, pause and back to the
 *               menu (tools/ux-audit-flow-page.js).
 * For each state it saves a screenshot and checks, in CSS px:
 *   - no scrolling container: scrollHeight/scrollWidth within clientHeight/Width + 1;
 *   - every control inside the viewport and hit by `elementFromPoint` at its
 *     centre — a control outside it is scrolled into view to tell a reachable
 *     vertical fallback (note) from content lost off-screen (failure);
 *   - every button label inside its box; no two buttons intersecting;
 *   - DOM HUD blocks (level, badge, objective, board, hearts, buttons,
 *     picture, answer banner) inside the screen, not overlapping, no word
 *     broken letter by letter;
 *   - text contrast against the background painted under it (layers
 *     composited, gradient stops worst case): 4.5:1, or 3:1 for large text and
 *     symbol-only labels; disabled controls and backgrounds CSS cannot tell
 *     (image, the Canvas showing through) are notes.
 * jsdom cannot measure any of this; this script is what validates layout.
 * The Canvas only draws the world and the edge arrow of assisted support,
 * which are not measured.
 *
 * Usage: node tools/ux-audit.mjs [--url http://localhost:5173] [--out dir]
 *        [--target menus,controle,flow] [--only home,settings]
 *        [--viewports 360x640,667x375] [--large-text] [--high-contrast]
 *        [--text-scale 2]   (browser text at 200%: vertical scrolling and
 *                            reachable off-screen controls become notes;
 *                            horizontal scroll and unreachable controls fail)
 * Exit code 1 when a check fails. Nothing here touches real saves: Chrome
 * runs with a throwaway profile, cleared before every flow.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : args[at + 1];
};
const BASE_URL = arg('url', 'http://localhost:5173');
const OUT = arg('out', join(tmpdir(), 'ux-audit'));
const ONLY = arg('only', '')?.split(',').filter(Boolean) ?? [];
const TARGETS = (arg('target', 'menus,controle,flow') || 'menus').split(',').filter(Boolean);
const TARGET_PAGES = {
  menus: { path: '/', script: 'ux-audit-page.js' },
  controle: { path: '/controle.html', script: 'ux-audit-controle-page.js' },
  flow: { path: '/', script: 'ux-audit-flow-page.js', freshProfile: true },
};
const LARGE_TEXT = args.includes('--large-text');
const HIGH_CONTRAST = args.includes('--high-contrast');
const TEXT_SCALE = Number(arg('text-scale', '1'));
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** docs/22 §10 matrix, CSS px. */
const DEFAULT_VIEWPORTS = [
  '320x568', '360x640', '375x667', '390x844', '412x915',
  '568x320', '640x360', '667x375', '844x390', '915x412',
  '768x1024', '1024x768', '1280x720',
];
const VIEWPORTS = (arg('viewports', '') || DEFAULT_VIEWPORTS.join(',')).split(',').map((size) => {
  const [width, height] = size.split('x').map(Number);
  return { width, height, label: size };
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), 'ux-audit-chrome-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = targets.find((target) => target.type === 'page');
      if (page) return { chrome, profile, ws: page.webSocketDebuggerUrl };
    } catch { /* not up yet */ }
    await sleep(200);
  }
  chrome.kill();
  throw new Error('Chrome did not start');
}

function connect(url) {
  const socket = new WebSocket(url);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method) {
      for (const listener of listeners.get(message.method) ?? []) listener(message.params);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const once = (method) => new Promise((resolve) => {
    const list = listeners.get(method) ?? [];
    const listener = (params) => {
      listeners.set(method, (listeners.get(method) ?? []).filter((l) => l !== listener));
      resolve(params);
    };
    listeners.set(method, [...list, listener]);
  });
  return new Promise((resolve) => socket.addEventListener('open', () => resolve({ send, once, close: () => socket.close() })));
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}

/** Runs in the page: overflow, reach and label checks for what is on screen now. */
const MEASURE = `(() => {
  // Measure the settled screen, not an entrance fade half way through.
  for (const animation of document.getAnimations()) {
    try { if (animation.effect?.getComputedTiming().endTime !== Infinity) animation.finish(); } catch { /* infinite or detached */ }
  }
  const issues = [];
  const vw = window.innerWidth, vh = window.innerHeight;
  // Not operable right now: under a modal or the orientation warning (inert), or folded in a closed <details>.
  const dormant = (el) => Boolean(el.closest('[inert]')) || (() => { const d = el.closest('details'); return Boolean(d && !d.open && !el.closest('summary')); })();
  const describe = (el) => (el.getAttribute('aria-label') || el.textContent || el.className || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 50);
  const warning = document.body.classList.contains('needs-landscape') ? ', .orientation-warning *' : '';
  const scope = [document.scrollingElement, ...document.querySelectorAll('#overlay-root *, #hud-controls-root *, #controle-root *' + warning)];
  for (const el of scope) {
    if (!el || el.closest('[hidden], .sr-only') || (el !== document.scrollingElement && dormant(el))) continue;
    if (el !== document.scrollingElement && (el.clientWidth <= 1 || el.clientHeight <= 1)) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const scrollsY = el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0;
    const scrollsX = el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0;
    const clips = (v) => v !== 'visible';
    // Registered exceptions (e.g. a full report shown when copying failed) scroll inside themselves on purpose.
    const exception = el !== document.scrollingElement && el.hasAttribute('data-scroll-exception');
    if (scrollsY && (clips(style.overflowY) || el === document.scrollingElement)) issues.push({ kind: exception ? 'scroll-exception' : 'scroll-y', what: describe(el).slice(0, 30), by: el.scrollHeight - el.clientHeight });
    if (scrollsX && (clips(style.overflowX) || el === document.scrollingElement)) issues.push({ kind: 'scroll-x', what: describe(el).slice(0, 30), by: el.scrollWidth - el.clientWidth });
  }
  const buttons = [...document.querySelectorAll('#overlay-root button, #hud-controls-root button, #overlay-root select, #overlay-root input, #controle-root button, #controle-root summary' + warning.replace(' *', ' button'))]
    .filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden' && !b.closest('.sr-only') && !dormant(b));
  // What is actually visible of each control: clipped by any scrolling/clipping ancestor.
  const visibleRect = (el) => {
    const r = el.getBoundingClientRect();
    let box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    for (let a = el.parentElement; a; a = a.parentElement) {
      const st = getComputedStyle(a);
      if (st.overflowY === 'visible' && st.overflowX === 'visible') continue;
      const c = a.getBoundingClientRect();
      box = { left: Math.max(box.left, c.left), top: Math.max(box.top, c.top), right: Math.min(box.right, c.right), bottom: Math.min(box.bottom, c.bottom) };
      box.width = Math.max(0, box.right - box.left); box.height = Math.max(0, box.bottom - box.top);
    }
    return box;
  };
  // A control outside the viewport is only a fallback if scrolling brings it fully into view and hittable.
  const reachable = (el) => {
    const saved = [];
    for (let a = el.parentElement; a; a = a.parentElement) saved.push([a, a.scrollTop, a.scrollLeft]);
    const root = document.scrollingElement;
    saved.push([root, root.scrollTop, root.scrollLeft]);
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    const inside = r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1;
    const hit = inside ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
    const ok = Boolean(hit && (hit === el || el.contains(hit) || (el.tagName === 'INPUT' && hit.closest('label')?.contains(el))));
    for (const [node, top, left] of saved) { node.scrollTop = top; node.scrollLeft = left; }
    return ok;
  };
  const rects = buttons.map((b) => b.getBoundingClientRect());
  const shown = buttons.map(visibleRect);
  buttons.forEach((b, i) => {
    const r = rects[i];
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) {
      issues.push({ kind: reachable(b) ? 'offscreen-reachable' : 'offscreen', what: describe(b), rect: [r.left, r.top, r.right, r.bottom].map(Math.round) });
      return;
    }
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (hit && hit !== b && !b.contains(hit) && !(b.tagName === 'INPUT' && hit.closest('label')?.contains(b))) issues.push({ kind: 'covered', what: describe(b), by: describe(hit) });
    if (b.tagName === 'BUTTON' && (b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1)) issues.push({ kind: 'label-overflow', what: describe(b) });
    if ((b.tagName === 'BUTTON' || b.tagName === 'SUMMARY') && (r.height < 47.5 || r.width < 47.5) && !b.closest('.touch-preview')) issues.push({ kind: 'small-target', what: describe(b), size: [Math.round(r.width), Math.round(r.height)] });
    for (let j = i + 1; j < buttons.length; j++) {
      const o = shown[j];
      const v = shown[i];
      if (buttons[j].contains(b) || b.contains(buttons[j])) continue;
      const overlapX = Math.min(v.right, o.right) - Math.max(v.left, o.left);
      const overlapY = Math.min(v.bottom, o.bottom) - Math.max(v.top, o.top);
      if (overlapX > 1 && overlapY > 1) issues.push({ kind: 'overlap', what: describe(b), with: describe(buttons[j]) });
    }
  });

  // Contrast (docs/17 §6): text colour against the background really painted
  // under it — semi-transparent layers composited, every gradient stop tried
  // (worst case kept). 4.5:1 for text, 3:1 for large text and for symbol-only
  // labels (component graphics). Disabled controls are exempt in WCAG but
  // still reported, as a note. A background that cannot be computed from CSS
  // (image, or the game Canvas showing through) is a note, not a pass.
  const px = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  px.canvas.width = px.canvas.height = 1;
  const colorCache = new Map();
  const rgba = (value) => {
    if (colorCache.has(value)) return colorCache.get(value);
    px.clearRect(0, 0, 1, 1);
    px.fillStyle = 'rgba(0,0,0,0)';
    px.fillStyle = value;
    px.fillRect(0, 0, 1, 1);
    const d = px.getImageData(0, 0, 1, 1).data;
    const color = [d[0], d[1], d[2], d[3] / 255];
    colorCache.set(value, color);
    return color;
  };
  const over = (top, below) => {
    const a = top[3] + below[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + below[i] * below[3] * (1 - top[3])) / a).concat(a);
  };
  const channel = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const colorsIn = (image) => (image.match(/(rgba?|hsla?|oklch|oklab|lab|lch|color)[(][^()]*[)]|#[0-9a-fA-F]{3,8}/g) ?? []);
  /** Candidate backdrops (child layers first), or a reason they cannot be computed. */
  const backdrops = (el) => {
    const layers = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const cs = getComputedStyle(node);
      const image = cs.backgroundImage;
      const own = [];
      if (image && image !== 'none') {
        if (image.includes('url(')) return { unmeasured: 'imagem de fundo' };
        own.push(colorsIn(image).map(rgba));
      }
      own.push([rgba(cs.backgroundColor)]);
      layers.push(...own);
      const opaque = own.some((set) => set.length && set.every((c) => c[3] >= 0.999));
      if (opaque) break;
      if (node === document.documentElement) {
        const r = el.getBoundingClientRect();
        const below = document.elementsFromPoint(Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), Math.min(vh - 1, Math.max(0, r.top + r.height / 2)));
        if (below.some((b) => b.tagName === 'CANVAS' && !el.contains(b))) return { unmeasured: 'Canvas por baixo' };
        layers.push([[255, 255, 255, 1]]);
      }
    }
    // Composite bottom-up, keeping every combination of gradient stops.
    let result = [[0, 0, 0, 0]];
    for (let i = layers.length - 1; i >= 0; i--) {
      const set = layers[i].length ? layers[i] : [[0, 0, 0, 0]];
      result = result.flatMap((below) => set.map((top) => over(top, below))).slice(0, 64);
    }
    return { colors: result.map((c) => over(c, [255, 255, 255, 1])) };
  };
  const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const textOf = (el) => (el.tagName === 'SELECT' ? el.selectedOptions[0]?.textContent ?? '' : el.tagName === 'INPUT' ? el.value : [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')).trim();
  const contrastSeen = new Set();
  const pending = [];
  window.__contrastPending = pending;
  /** Worst decile of sampled backdrop pixels, from a screenshot taken with all text transparent. */
  window.__contrastSample = async (src) => {
    document.getElementById('__audit_hide')?.remove();
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const k = img.width / vw;
    return pending.map((p) => {
      const ratios = [];
      for (const [x, y, w, h] of p.rects) {
        for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) {
          const sx = Math.floor((x + (w * (i + 0.5)) / 8) * k);
          const sy = Math.floor((y + (h * (j + 0.5)) / 4) * k);
          if (sx < 0 || sy < 0 || sx >= canvas.width || sy >= canvas.height) continue;
          const d = ctx.getImageData(sx, sy, 1, 1).data;
          const bg = [d[0], d[1], d[2], 1];
          ratios.push(ratio(over(p.fg, bg), bg));
        }
      }
      ratios.sort((a, b) => a - b);
      return { what: p.what, need: p.need, reason: p.reason, ratio: ratios.length ? ratios[Math.floor(ratios.length * 0.1)] : null };
    });
  };
  for (const el of document.querySelectorAll('#app *, body > *:not(script):not(style) *')) {
    if (contrastSeen.has(el)) continue;
    contrastSeen.add(el);
    const field = el.tagName === 'SELECT' || (el.tagName === 'INPUT' && ['text', 'number', 'search'].includes(el.type));
    if (!field && !hasOwnText(el)) continue;
    if (el.closest('svg, canvas, option, script, style, [hidden]') || dormant(el)) continue;
    const r = el.getBoundingClientRect();
    // Visually hidden labels (screen readers only) are 1 px and clipped: nothing to see.
    if (r.width <= 2 || r.height <= 2 || r.bottom <= 0 || r.right <= 0 || r.top >= vh || r.left >= vw) continue;
    const cs = getComputedStyle(el);
    if ((cs.clip && cs.clip !== 'auto') || (cs.clipPath && cs.clipPath.startsWith('inset(50%'))) continue;
    if (cs.visibility !== 'visible' || cs.display === 'none') continue;
    let opacity = 1;
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    if (opacity < 0.01) continue;
    const text = textOf(el);
    // Emoji keep their own colours whatever CSS says: nothing to measure.
    if (!text || !/[^\\s\\p{Extended_Pictographic}\\u200d\\ufe0f]/u.test(text)) continue;
    const fg = rgba(cs.color);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    const symbolsOnly = !/[0-9A-Za-zÀ-ÿ]/.test(text);
    const need = large || symbolsOnly ? 3 : 4.5;
    const back = backdrops(el);
    const what = text.replace(/\\s+/g, ' ').slice(0, 30);
    if (back.unmeasured) {
      // Resolved from a screenshot with the text hidden (see sampleContrast).
      const rects = field ? [el.getBoundingClientRect()] : [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).flatMap((n) => {
        const range = document.createRange();
        range.selectNodeContents(n);
        return [...range.getClientRects()];
      });
      // Only the part actually on screen: clipped by scrolling/overflow ancestors and the viewport.
      let clip = { left: 0, top: 0, right: vw, bottom: vh };
      for (let node = el.parentElement; node; node = node.parentElement) {
        const ov = getComputedStyle(node);
        if (ov.overflowX === 'visible' && ov.overflowY === 'visible') continue;
        // Inside the borders: content is clipped at the padding box.
        const box = node.getBoundingClientRect();
        const inner = { left: box.left + node.clientLeft, top: box.top + node.clientTop };
        clip = { left: Math.max(clip.left, inner.left), top: Math.max(clip.top, inner.top), right: Math.min(clip.right, inner.left + node.clientWidth), bottom: Math.min(clip.bottom, inner.top + node.clientHeight) };
      }
      const visibleRects = rects.map((q) => {
        const left = Math.max(q.left, clip.left), top = Math.max(q.top, clip.top);
        return [left, top, Math.min(q.right, clip.right) - left, Math.min(q.bottom, clip.bottom) - top];
      }).filter(([, , w, h]) => w > 2 && h > 2);
      if (!visibleRects.length) continue;
      pending.push({ what, need, reason: back.unmeasured, fg: [fg[0], fg[1], fg[2], fg[3] * opacity], rects: visibleRects });
      continue;
    }
    const worst = Math.min(...back.colors.map((bg) => ratio(over([fg[0], fg[1], fg[2], fg[3] * opacity], bg), bg)));
    if (worst + 0.005 < need) {
      const inactive = Boolean(el.closest(':disabled, [aria-disabled="true"]'));
      issues.push({ kind: inactive ? 'contrast-inactive' : 'contrast', what, by: worst.toFixed(2) + ':1 < ' + need + ':1' });
    }
  }

  // DOM HUD (docs/17 §4 entrega 5): its blocks never overlap, never leave the
  // screen (the HUD does not scroll) and never break a word inside a line.
  const hudBlocks = [...document.querySelectorAll('.hud-layer :is(.hud-level, .hud-badge, .hud-objective, .hud-board, .hud-hearts, .hud-controls-bar, .hud-word-picture, .hud-feedback)')]
    .filter((el) => !dormant(el) && el.getClientRects().length);
  hudBlocks.forEach((el, i) => {
    const a = el.getBoundingClientRect();
    if (a.left < -1 || a.top < -1 || a.right > vw + 1 || a.bottom > vh + 1) issues.push({ kind: 'offscreen', what: describe(el), rect: [a.left, a.top, a.right, a.bottom].map(Math.round) });
    for (const other of hudBlocks.slice(i + 1)) {
      if (el.contains(other) || other.contains(el)) continue;
      const b = other.getBoundingClientRect();
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) issues.push({ kind: 'overlap', what: describe(el), with: describe(other) });
    }
    if (el.matches('.hud-level, .hud-badge, .hud-objective, .hud-feedback')) {
      // A word split across two lines has more than one line box.
      for (const node of [...el.querySelectorAll('*'), el].flatMap((e) => [...e.childNodes]).filter((n) => n.nodeType === 3)) {
        for (const m of node.textContent.matchAll(/[^\\s]+/g)) {
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const tops = new Set([...range.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top)));
          if (tops.size > 1) issues.push({ kind: 'word-broken', what: describe(el), by: m[0] });
        }
      }
    }
  });
  const board = document.querySelector('.home-board');
  let centring = null;
  if (board) {
    const host = board.parentElement.getBoundingClientRect();
    const r = board.getBoundingClientRect();
    const cs = getComputedStyle(board.parentElement);
    const top = r.top - host.top - parseFloat(cs.paddingTop);
    const bottom = host.bottom - r.bottom - parseFloat(cs.paddingBottom);
    centring = Math.round(Math.abs(top - bottom));
    if (top >= 0 && bottom >= 0 && centring > 8) issues.push({ kind: 'not-centred', what: 'home-board', by: centring });
  }
  return { issues, centring, pendingContrast: pending.length };
})()`;

/** Makes every glyph transparent so a screenshot shows only what is painted behind the text. */
const HIDE_TEXT = `(() => {
  const style = document.createElement('style');
  style.id = '__audit_hide';
  style.textContent = '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; transition: none !important; }';
  document.head.appendChild(style);
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))));
})()`;

/** Contrast over backgrounds CSS cannot describe (images, the game Canvas), measured on real pixels. */
async function sampleContrast(cdp) {
  await evaluate(cdp, HIDE_TEXT);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const results = await evaluate(cdp, `window.__contrastSample(${JSON.stringify(`data:image/png;base64,${shot.data}`)})`);
  return results.map((r) => (r.ratio === null
    ? { kind: 'contrast-unmeasured', what: r.what, by: r.reason }
    : r.ratio + 0.005 < r.need ? { kind: 'contrast', what: r.what, by: `${r.ratio.toFixed(2)}:1 < ${r.need}:1 (${r.reason}, pixels)` } : null)).filter(Boolean);
}

/** Kinds that never fail the run: a reachable fallback is recorded, not hidden. */
const NOTE_KINDS = new Set(['offscreen-reachable', 'scroll-exception', 'contrast-inactive', 'contrast-unmeasured']);
/** With browser text at 200%, the vertical fallback itself is expected (docs/22 §2). */
const TEXT_SCALE_NOTE_KINDS = new Set(['scroll-y', 'not-centred']);

const describeIssue = (i) => `${i.kind}(${i.what}${i.by !== undefined ? ` · ${typeof i.by === 'number' ? i.by + 'px' : i.by}` : ''}${i.with ? ` × ${i.with}` : ''}${i.size ? ` ${i.size.join('×')}` : ''})`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { chrome, profile, ws } = await launchChrome();
  const cdp = await connect(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  const report = [];
  let failures = 0;
  let notes = 0;
  try {
    for (const viewport of VIEWPORTS) {
      const landscape = viewport.width > viewport.height;
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width, height: viewport.height, deviceScaleFactor: 2, mobile: viewport.width < 1024,
        screenOrientation: { type: landscape ? 'landscapePrimary' : 'portraitPrimary', angle: landscape ? 90 : 0 },
      });
      await cdp.send('Emulation.setTouchEmulationEnabled', viewport.width < 1024 ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
      for (const target of TARGETS) {
        const page = TARGET_PAGES[target];
        if (!page) throw new Error(`Unknown --target ${target}`);
        const pageScript = readFileSync(join(HERE, page.script), 'utf8');
        const url = new URL(page.path, BASE_URL).href;
        if (page.freshProfile) {
          await evaluate(cdp, 'try { localStorage.clear(); sessionStorage.clear(); } catch {} true');
        }
        const loaded = cdp.once('Page.loadEventFired');
        await cdp.send('Page.navigate', { url });
        await loaded;
        await sleep(600);
        await evaluate(cdp, pageScript);
        const screens = await evaluate(cdp, `window.__uxAudit.list(${JSON.stringify({ largeText: LARGE_TEXT, textScale: TEXT_SCALE, highContrast: HIGH_CONTRAST })})`);
        for (const name of screens) {
          // A flow is a sequence: every step runs, only the selected ones are reported.
          const selected = !ONLY.length || ONLY.some((prefix) => name.startsWith(prefix));
          if (!selected && !page.freshProfile) continue;
          const outcome = await evaluate(cdp, `window.__uxAudit.show(${JSON.stringify(name)})`);
          const stepError = typeof outcome === 'string' ? outcome : null;
          await sleep(250);
          if (!selected || outcome?.skip) continue;
          let { issues, centring, pendingContrast } = await evaluate(cdp, MEASURE);
          if (stepError) issues.push({ kind: 'flow-error', what: stepError });
          const noteKinds = TEXT_SCALE > 1 ? new Set([...NOTE_KINDS, ...TEXT_SCALE_NOTE_KINDS]) : NOTE_KINDS;
          const stepNotes = issues.filter((issue) => noteKinds.has(issue.kind));
          issues = issues.filter((issue) => !noteKinds.has(issue.kind));
          const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
          const file = join(OUT, `${viewport.label}${LARGE_TEXT ? '-large' : ''}${HIGH_CONTRAST ? '-contrast' : ''}${TEXT_SCALE > 1 ? `-x${TEXT_SCALE}` : ''}-${name}.png`);
          writeFileSync(file, Buffer.from(shot.data, 'base64'));
          if (pendingContrast) {
            const sampled = await sampleContrast(cdp);
            issues.push(...sampled.filter((issue) => !noteKinds.has(issue.kind)));
            stepNotes.push(...sampled.filter((issue) => noteKinds.has(issue.kind)));
          }
          failures += issues.length;
          notes += stepNotes.length;
          report.push({ viewport: viewport.label, target, screen: name, centring, issues, notes: stepNotes });
          const status = issues.length ? `✗ ${issues.map(describeIssue).join('; ')}` : '✓';
          const noteText = stepNotes.length ? `  (nota: ${stepNotes.map(describeIssue).join('; ')})` : '';
          console.log(`${viewport.label.padEnd(9)} ${name.padEnd(30)} ${status}${noteText}`);
          if (stepError) break; // the rest of this flow would be measuring the wrong screen
        }
      }
    }
  } finally {
    writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    cdp.close();
    chrome.kill();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
  }
  console.log(`\n${report.length} estado(s) medidos, ${failures} problema(s), ${notes} nota(s). Capturas e report.json em ${OUT}`);
  process.exitCode = failures ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
