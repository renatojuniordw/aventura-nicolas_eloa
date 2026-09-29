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
 *   - every button label inside its box; no two buttons intersecting.
 * jsdom cannot measure any of this; this script is what validates layout.
 * Canvas-drawn HUD content is not measured (only the DOM controls over it).
 *
 * Usage: node tools/ux-audit.mjs [--url http://localhost:5173] [--out dir]
 *        [--target menus,controle,flow] [--only home,settings]
 *        [--viewports 360x640,667x375] [--large-text]
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
  return { issues, centring };
})()`;

/** Kinds that never fail the run: a reachable fallback is recorded, not hidden. */
const NOTE_KINDS = new Set(['offscreen-reachable', 'scroll-exception']);
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
        const screens = await evaluate(cdp, `window.__uxAudit.list(${JSON.stringify({ largeText: LARGE_TEXT, textScale: TEXT_SCALE })})`);
        for (const name of screens) {
          // A flow is a sequence: every step runs, only the selected ones are reported.
          const selected = !ONLY.length || ONLY.some((prefix) => name.startsWith(prefix));
          if (!selected && !page.freshProfile) continue;
          const outcome = await evaluate(cdp, `window.__uxAudit.show(${JSON.stringify(name)})`);
          const stepError = typeof outcome === 'string' ? outcome : null;
          await sleep(250);
          if (!selected || outcome?.skip) continue;
          let { issues, centring } = await evaluate(cdp, MEASURE);
          if (stepError) issues.push({ kind: 'flow-error', what: stepError });
          const noteKinds = TEXT_SCALE > 1 ? new Set([...NOTE_KINDS, ...TEXT_SCALE_NOTE_KINDS]) : NOTE_KINDS;
          const stepNotes = issues.filter((issue) => noteKinds.has(issue.kind));
          issues = issues.filter((issue) => !noteKinds.has(issue.kind));
          const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
          const file = join(OUT, `${viewport.label}${LARGE_TEXT ? '-large' : ''}${TEXT_SCALE > 1 ? `-x${TEXT_SCALE}` : ''}-${name}.png`);
          writeFileSync(file, Buffer.from(shot.data, 'base64'));
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
