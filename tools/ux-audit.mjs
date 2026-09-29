#!/usr/bin/env node
/**
 * Visual/geometry audit of the menu screens (docs/22 §10), in a real browser.
 *
 * Starts headless Chrome, opens the running dev server (`npm run dev`), and
 * for every viewport of the matrix mounts each screen through the same
 * builders the game uses (tools/ux-audit-page.js, loaded through Vite). For
 * each screen it saves a screenshot and checks, in CSS px:
 *   - no scrolling container: scrollHeight/scrollWidth within clientHeight/Width + 1;
 *   - every button inside the viewport and hit by `elementFromPoint` at its centre;
 *   - every button label inside its box; no two buttons intersecting.
 * jsdom cannot measure any of this; this script is what validates layout.
 *
 * Usage: node tools/ux-audit.mjs [--url http://localhost:5173] [--out dir]
 *        [--only home,settings] [--viewports 360x640,667x375] [--large-text]
 *        [--text-scale 2]   (browser text at 200%: only horizontal scroll and
 *                            cut-off content fail; the vertical fallback is expected)
 * Exit code 1 when a check fails. Nothing here touches real saves: Chrome
 * runs with a throwaway profile.
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
  const describe = (el) => (el.getAttribute('aria-label') || el.textContent || el.className || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 50);
  const scope = [document.scrollingElement, ...document.querySelectorAll('#overlay-root *, #hud-controls-root *')];
  for (const el of scope) {
    if (!el || el.closest('[hidden], .sr-only')) continue;
    if (el !== document.scrollingElement && (el.clientWidth <= 1 || el.clientHeight <= 1)) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const scrollsY = el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0;
    const scrollsX = el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0;
    const clips = (v) => v !== 'visible';
    if (scrollsY && (clips(style.overflowY) || el === document.scrollingElement)) issues.push({ kind: 'scroll-y', what: describe(el).slice(0, 30), by: el.scrollHeight - el.clientHeight });
    if (scrollsX && (clips(style.overflowX) || el === document.scrollingElement)) issues.push({ kind: 'scroll-x', what: describe(el).slice(0, 30), by: el.scrollWidth - el.clientWidth });
  }
  const buttons = [...document.querySelectorAll('#overlay-root button, #hud-controls-root button, #overlay-root select, #overlay-root input')]
    .filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden' && !b.closest('.sr-only'));
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
  const rects = buttons.map((b) => b.getBoundingClientRect());
  const shown = buttons.map(visibleRect);
  buttons.forEach((b, i) => {
    const r = rects[i];
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) { issues.push({ kind: 'offscreen', what: describe(b), rect: [r.left, r.top, r.right, r.bottom].map(Math.round) }); return; }
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (hit && hit !== b && !b.contains(hit) && !(b.tagName === 'INPUT' && hit.closest('label')?.contains(b))) issues.push({ kind: 'covered', what: describe(b), by: describe(hit) });
    if (b.tagName === 'BUTTON' && (b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1)) issues.push({ kind: 'label-overflow', what: describe(b) });
    if (b.tagName === 'BUTTON' && (r.height < 47.5 || r.width < 47.5) && !b.closest('.touch-preview')) issues.push({ kind: 'small-target', what: describe(b), size: [Math.round(r.width), Math.round(r.height)] });
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

async function main() {
  mkdirSync(OUT, { recursive: true });
  const pageScript = readFileSync(join(HERE, 'ux-audit-page.js'), 'utf8');
  const { chrome, profile, ws } = await launchChrome();
  const cdp = await connect(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  const report = [];
  let failures = 0;
  try {
    for (const viewport of VIEWPORTS) {
      const landscape = viewport.width > viewport.height;
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width, height: viewport.height, deviceScaleFactor: 2, mobile: viewport.width < 1024,
        screenOrientation: { type: landscape ? 'landscapePrimary' : 'portraitPrimary', angle: landscape ? 90 : 0 },
      });
      await cdp.send('Emulation.setTouchEmulationEnabled', viewport.width < 1024 ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
      const loaded = cdp.once('Page.loadEventFired');
      await cdp.send('Page.navigate', { url: BASE_URL });
      await loaded;
      await sleep(600);
      await evaluate(cdp, pageScript);
      const screens = await evaluate(cdp, `window.__uxAudit.list(${JSON.stringify({ largeText: LARGE_TEXT, textScale: TEXT_SCALE })})`);
      for (const name of screens) {
        if (ONLY.length && !ONLY.some((prefix) => name.startsWith(prefix))) continue;
        await evaluate(cdp, `window.__uxAudit.show(${JSON.stringify(name)})`);
        await sleep(250);
        let { issues, centring } = await evaluate(cdp, MEASURE);
        // Zoomed text: the single vertical fallback container is allowed (docs/22 §2).
        if (TEXT_SCALE > 1) issues = issues.filter((issue) => !['scroll-y', 'offscreen', 'not-centred'].includes(issue.kind));
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        const file = join(OUT, `${viewport.label}${LARGE_TEXT ? '-large' : ''}${TEXT_SCALE > 1 ? `-x${TEXT_SCALE}` : ''}-${name}.png`);
        writeFileSync(file, Buffer.from(shot.data, 'base64'));
        failures += issues.length;
        report.push({ viewport: viewport.label, screen: name, centring, issues });
        const status = issues.length ? `✗ ${issues.map((i) => `${i.kind}(${i.what}${i.by !== undefined ? ` · ${typeof i.by === 'number' ? i.by + 'px' : i.by}` : ''}${i.with ? ` × ${i.with}` : ''}${i.size ? ` ${i.size.join('×')}` : ''})`).join('; ')}` : '✓';
        console.log(`${viewport.label.padEnd(9)} ${name.padEnd(26)} ${status}`);
      }
    }
  } finally {
    writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    cdp.close();
    chrome.kill();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
  }
  console.log(`\n${failures} issue(s). Screenshots and report.json in ${OUT}`);
  process.exitCode = failures ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
