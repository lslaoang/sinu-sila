// Run before deploying: node tools/smoke_test.mjs (Node 22+, set CHROME to override Chrome).
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { T } from '../assets/js/messages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const chromePath = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const types = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
};
const server = createServer(async (req, res) => {
  try {
    // Mirror the staging prefix while serving the same static files.
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/staging\//, '/');
    if (path.includes('\\') || path.split('/').some(part => part.startsWith('.'))) {
      res.writeHead(404).end();
      return;
    }
    const file = join(root, path === '/' ? 'index.html' : path);
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    const stream = createReadStream(file);
    stream.on('error', () => res.destroy());
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    stream.pipe(res);
  } catch {
    res.writeHead(404).end();
  }
});

let profile, chrome, chromeClosed, chromeError, chromeLog = '', cleaning;
function cleanup() {
  return cleaning ??= (async () => {
    const serverClosed = new Promise(resolve => server.close(resolve));
    server.closeAllConnections();
    if (chrome) {
      chrome.kill('SIGTERM');
      const forceKill = setTimeout(() => chrome.kill('SIGKILL'), 3_000);
      await chromeClosed;
      clearTimeout(forceKill);
    }
    await serverClosed;
    if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 4 });
  })();
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, async () => {
    try { await cleanup(); } finally { process.exit(1); }
  });
}

async function until(check, message, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await delay(100);
  }
  throw new Error(message);
}

async function devtools(url, onEvent) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 0;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return onEvent(message.method, message.params);
    const reply = pending.get(message.id);
    if (!reply) return;
    pending.delete(message.id);
    if (message.error) reply.reject(new Error(message.error.message));
    else reply.resolve(message.result);
  });
  socket.addEventListener('close', () => {
    for (const reply of pending.values()) reply.reject(new Error('DevTools socket closed'));
    pending.clear();
  });
  try {
    await until(() => {
      if (socket.readyState >= WebSocket.CLOSING) throw new Error('DevTools connection failed');
      return socket.readyState === WebSocket.OPEN;
    }, 'DevTools connection timed out', 5_000);
  } catch (error) {
    socket.close();
    throw error;
  }
  return {
    close: () => socket.close(),
    send(method, params) {
      if (socket.readyState !== WebSocket.OPEN) throw new Error('DevTools socket closed');
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
        setTimeout(() => {
          if (pending.delete(id)) reject(new Error(method + ' timed out'));
        }, 10_000).unref();
      });
    },
  };
}

function inspect(keys, lang) {
  const problems = [];
  if (!document.querySelector('h1')) problems.push('missing h1');
  if (getComputedStyle(document.querySelector('.flag')).display !== 'flex') problems.push('site stylesheet did not apply');
  if (document.documentElement.scrollWidth > innerWidth) {
    problems.push('horizontal overflow (' + document.documentElement.scrollWidth + ' > ' + innerWidth + ')');
  }
  if (document.documentElement.lang !== lang) problems.push('expected language ' + lang);
  const known = new Set(keys);
  const leaked = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node; (node = walker.nextNode());) {
    const value = node.textContent.trim();
    if (!value || node.parentElement.closest('script,style,template,noscript')) continue;
    const tokens = value.match(/[\p{L}\p{N}_]+(?:-[\p{L}\p{N}_]+)*/gu) || [];
    const matches = tokens.filter(token => token === 'undefined' || token === 'NaN'
      || (known.has(token) && /[a-z][A-Z]|_/.test(token)));   // a leaked key looks like an identifier ("hCareer", "st_pending"); "votes" or "lawmakers" are also plain words
    if (!matches.length || getComputedStyle(node.parentElement).visibility !== 'visible') continue;
    range.selectNodeContents(node);
    if (range.getClientRects().length) matches.forEach(token => leaked.add(token));
  }
  if (leaked.size) problems.push('raw text: ' + [...leaked].join(', '));
  const broken = new Set(globalThis.smokeImageErrors);
  for (const img of document.images) {
    if (img.complete && img.naturalWidth === 0) broken.add(img.currentSrc || img.src || '(no source)');
  }
  if (broken.size) problems.push('broken images: ' + [...broken].join(', '));
  return problems;
}

async function checkSearchAndLanguage(evaluate, person) {
  await evaluate(`(() => {
    const q = document.getElementById('q');
    q.focus();
    q.value = ${JSON.stringify(person.name)};
    q.dispatchEvent(new Event('input', {bubbles: true}));
  })()`);
  const profileHash = JSON.stringify('#' + person.id);
  await until(() => evaluate(`!document.getElementById('qd').hidden &&
    [...document.querySelectorAll('#qd [data-href]')].some(el => el.dataset.href === ${profileHash})`),
  'header search did not find the sample senator');
  await evaluate(`[...document.querySelectorAll('#qd [data-href]')]
    .find(el => el.dataset.href === ${profileHash}).click()`);
  await until(() => evaluate(`location.hash === ${profileHash} && !!document.querySelector('#app .ptabs')`),
  'selecting a search result did not open the profile');
  await evaluate(`(() => {
    const picker = document.getElementById('langSel');
    picker.value = 'fil';
    picker.dispatchEvent(new Event('change', {bubbles: true}));
  })()`);
  await until(() => evaluate(`document.documentElement.lang === 'fil' && !!document.querySelector('#app .ptabs')`),
  'changing language did not render the Filipino profile');
  await evaluate(`document.getElementById('repB').click()`);
  await until(() => evaluate(`document.getElementById('rep').open`), 'report dialog did not open');
  await evaluate(`document.getElementById('repX').click()`);
}

async function checkSenateMotion(evaluate, reducedMotion) {
  const result = await evaluate(`(() => {
    const seats = [...document.querySelectorAll('#hemi .seat')];
    const bills = document.querySelector('[data-lens="bills"]');
    const first = seats.map(seat => getComputedStyle(seat).translate);
    const noEmptyCounts = [...document.querySelectorAll('.fact .n')].every(el => el.textContent.trim() !== '');
    bills.click();
    return {
      selected: bills.getAttribute('aria-pressed') === 'true',
      noEmptyCounts,
      animating: seats.some(seat => {
        getComputedStyle(seat).translate;
        return seat.getAnimations().some(animation => animation.transitionProperty === 'translate');
      }),
      moved: seats.some((seat, i) => getComputedStyle(seat).translate !== first[i]),
    };
  })()`);
  if (!result.selected || !result.noEmptyCounts) throw new Error('Senate filters or figures did not render');
  if (reducedMotion && (result.animating || !result.moved)) throw new Error('reduced motion should move seats immediately');
  if (!reducedMotion && !result.animating) throw new Error('changing the Senate lens did not animate seat movement');
  await until(() => evaluate(`!document.getElementById('hemi').getAnimations({subtree: true}).length`),
    'Senate chart did not settle');
}

async function testPage(debug, url, width, height, lang, keys, { searchPerson, checkMotion, reducedMotion }) {
  const problems = new Set();
  const response = await fetch(debug + '/json/new?about:blank', { method: 'PUT', signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error('Could not open Chrome tab: HTTP ' + response.status);
  const tab = await response.json();
  let cdp;
  try {
    cdp = await devtools(tab.webSocketDebuggerUrl, (method, params) => {
      if (method === 'Runtime.exceptionThrown') {
        const details = params.exceptionDetails;
        problems.add(details.exception?.description || details.text);
      } else if (method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(params.type)) {
        problems.add('console error: ' + params.args.map(arg => arg.description ?? arg.value ?? arg.type).join(' '));
      } else if (method === 'Log.entryAdded' && params.entry.level === 'error') {
        problems.add(params.entry.text + (params.entry.url ? ' (' + params.entry.url + ')' : ''));
      }
    });
    const evaluate = async expression => {
      const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'Page evaluation failed');
      return result.result.value;
    };
    await Promise.all(['Page', 'Runtime', 'Log'].map(domain => cdp.send(domain + '.enable')));
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: width < 600,
    });
    if (reducedMotion) {
      await cdp.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    }
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('lang', ${JSON.stringify(lang)});
      globalThis.smokeImageErrors = new Set();
      addEventListener('error', event => {
        if (event.target instanceof HTMLImageElement) {
          smokeImageErrors.add(event.target.currentSrc || event.target.src);
        }
      }, true);
    ` });
    const navigation = await cdp.send('Page.navigate', { url });
    if (navigation.errorText) throw new Error(navigation.errorText);
    await until(() => evaluate(`location.href !== 'about:blank' &&
      document.querySelector('main:not([aria-busy="true"])') !== null`), 'main did not finish loading');
    await evaluate(`for (const img of document.images) img.loading = 'eager'`);
    await delay(1_500);
    for (const problem of await evaluate(`(${inspect})(${JSON.stringify(keys)}, ${JSON.stringify(lang)})`)) {
      problems.add(problem);
    }
    if (searchPerson) await checkSearchAndLanguage(evaluate, searchPerson);
    if (checkMotion) await checkSenateMotion(evaluate, reducedMotion);
  } catch (error) {
    problems.add(error.message);
  } finally {
    cdp?.close();
    await fetch(debug + '/json/close/' + tab.id, { signal: AbortSignal.timeout(5_000) });
  }
  return [...problems];
}

async function run() {
  const languages = ['en', 'fil', 'ceb', 'ilo', 'hil', 'war', 'bcl', 'pam'];
  const read = path => readFile(join(root, path), 'utf8');
  const json = async path => JSON.parse(await read(path));
  const [senators, house, html, ...translations] = await Promise.all([
    json('data/officials.json'), json('data/house.json'), read('index.html'),
    ...languages.slice(2).map(lang => json('i18n/' + lang + '.json')),
  ]);
  const keys = [...new Set([
    ...Object.keys(T.en), ...Object.keys(T.fil),
    ...translations.flatMap(table => Object.keys(table)),
    ...Array.from(html.matchAll(/data-i18n(?:-html|-ph|-al)?="([\w-]+)"/g), match => match[1]),
  ])];
  const profiles = [senators[0], house.people.find(p => p.kind === 'district'),
    house.people.find(p => p.kind === 'party-list')];
  if (profiles.some(person => !person?.id)) throw new Error('Missing a senator, district or party-list profile');
  const routes = ['', 'senado', 'kamara', 'party-list', 'mga-kaso', 'gabay', 'bago', 'explore',
    ...profiles.map(person => encodeURIComponent(person.id))];

  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  profile = await mkdtemp(join(tmpdir(), 'sinosila-smoke-'));   // outside the repo, so a killed run leaves nothing to commit
  chrome = spawn(chromePath, ['--headless', '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  chromeClosed = new Promise(resolve => chrome.once('close', resolve));
  chrome.on('error', error => { chromeError = error; });
  chrome.stderr.on('data', chunk => { chromeLog = (chromeLog + chunk).slice(-3000); });
  const port = await until(async () => {
    if (chromeError) throw chromeError;
    if (chrome.exitCode !== null || chrome.signalCode) throw new Error('Chrome exited during startup: ' + chromeLog.trim());
    return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).match(/^\d+/)?.[0];
  }, 'Chrome DevTools did not start');
  const debug = 'http://127.0.0.1:' + port;

  const pages = [[1280, 900], [375, 812]].flatMap(([width, height]) =>
    routes.map(route => ({ route, width, height, lang: 'en', checkMotion: route === 'explore' })));
  pages.push(...languages.map(lang => ({ route: '', width: 1280, height: 900, lang })));
  pages.push({ route: 'senado', width: 1280, height: 900, lang: 'en', searchPerson: senators[0] });
  pages.push({ route: 'explore', width: 375, height: 812, lang: 'en', checkMotion: true, reducedMotion: true });
  let failed = 0;
  for (const { route, width, height, lang, ...options } of pages) {
    const page = (options.searchPerson ? '/staging/index.html' : '/') + '#' + route;
    const problems = await testPage(debug, origin + page, width, height, lang, keys, options)
      .catch(error => [error.message]);
    if (problems.length) failed++;
    const detail = problems.length ? ' — ' + problems.join(' | ').replace(/\s+/g, ' ') : '';
    console.log(`${problems.length ? 'FAIL' : 'PASS'} ${page} ${width}x${height} (${lang}${options.reducedMotion ? ', reduced motion' : ''})${detail}`);
  }
  console.log(`Smoke test: ${pages.length - failed} passed, ${failed} failed (${pages.length} total)`);
  return failed ? 1 : 0;
}

try {
  process.exitCode = await run();
} catch (error) {
  console.error('Smoke test could not run: ' + error.message);
  process.exitCode = 1;
} finally {
  await cleanup();
}
