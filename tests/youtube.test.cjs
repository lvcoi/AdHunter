const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Browser and extension APIs are unavailable to Node. This fixture supplies those
// boundaries; it executes the real controller. It does not validate Chrome layout,
// extension injection, or whether YouTube accepts a synthetic click.
const sourcePath = path.join(__dirname, '..', 'youtube.js');
const source = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, 'utf8') : '';

function fixture({ ad = true, root = true, muted = false } = {}) {
  let now = 0;
  let nextTimer = 1;
  const timers = new Map();
  const observers = new Set();
  const messages = new Set();
  const requests = [];

  class Element extends EventTarget {
    constructor(tag, attrs = {}) {
      super();
      this.tagName = tag.toUpperCase();
      this.parentNode = null;
      this.children = [];
      this.attrs = { ...attrs };
      this.style = {};
      this.disabled = false;
      this.muted = false;
      this.clicks = 0;
      this.classList = {
        contains: value => this.className.split(/\s+/).includes(value),
        add: (...values) => this.setAttribute('class', [...new Set([...this.className.split(/\s+/).filter(Boolean), ...values])].join(' ')),
        remove: (...values) => this.setAttribute('class', this.className.split(/\s+/).filter(value => !values.includes(value)).join(' '))
      };
      for (const property of ['currentTime', 'duration', 'playbackRate']) {
        Object.defineProperty(this, property, {
          get: () => property === 'playbackRate' ? 1 : 123,
          set: () => { throw new Error('Controller must not write ' + property); }
        });
      }
    }
    get id() { return this.attrs.id || ''; }
    get className() { return this.attrs.class || ''; }
    get isConnected() { return this === document || Boolean(this.parentNode?.isConnected); }
    get parentElement() { return this.parentNode instanceof Element && this.parentNode !== document ? this.parentNode : null; }
    get hidden() { return this.hasAttribute('hidden'); }
    getAttribute(name) { return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null; }
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
    setAttribute(name, value) { this.attrs[name] = String(value); notify(this, 'attributes', name); }
    removeAttribute(name) { delete this.attrs[name]; notify(this, 'attributes', name); }
    appendChild(child) { if (child.parentNode) child.remove(); child.parentNode = this; this.children.push(child); notify(this, 'childList'); return child; }
    remove() { const parent = this.parentNode; if (parent) { parent.children = parent.children.filter(child => child !== this); this.parentNode = null; notify(parent, 'childList'); } }
    contains(other) { return other === this || this.children.some(child => child.contains(other)); }
    matches(selector) {
      return selector.split(',').some(part => {
        const s = part.trim();
        const tag = s.match(/^[a-z][a-z0-9-]*/i)?.[0];
        const id = s.match(/#([\w-]+)/)?.[1];
        const classes = [...s.matchAll(/\.([\w-]+)/g)].map(match => match[1]);
        return (!tag || this.tagName === tag.toUpperCase()) && (!id || this.id === id) && classes.every(value => this.classList.contains(value));
      });
    }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    getClientRects() { for (let el = this; el; el = el.parentNode) if (el.hidden || el.style.display === 'none') return []; return this.isConnected ? [{ width: 90, height: 32 }] : []; }
    click() { this.clicks++; this.dispatchEvent(new Event('click')); }
  }

  const document = new Element('document');
  document.getElementById = id => document.querySelector('#' + id);
  Object.defineProperty(document, 'documentElement', { get: () => document.children.find(child => child.tagName === 'HTML') || null });
  const html = new Element('html');
  const body = html.appendChild(new Element('body'));
  const player = body.appendChild(new Element('div', { id: 'movie_player', class: ad ? 'html5-video-player ad-showing ad-interrupting' : 'html5-video-player' }));
  const video = player.appendChild(new Element('video'));
  video.muted = muted;
  const skip = player.appendChild(new Element('button', { class: 'ytp-skip-ad-button' }));
  skip.style.opacity = '0.5';
  if (root) document.appendChild(html);

  function notify(target, type, attributeName) {
    for (const observer of observers) {
      if (!observer.target || !(observer.target === target || observer.options.subtree && observer.target.contains(target))) continue;
      if (!observer.options[type]) continue;
      if (type === 'attributes' && observer.options.attributeFilter && !observer.options.attributeFilter.includes(attributeName)) continue;
      observer.records.push({ target, type, attributeName });
      if (!observer.pending) {
        observer.pending = true;
        queueMicrotask(() => { observer.pending = false; const records = observer.records.splice(0); if (observer.target && records.length) observer.callback(records); });
      }
    }
  }
  class MutationObserver {
    constructor(callback) { this.callback = callback; this.records = []; this.pending = false; }
    observe(target, options) { this.target = target; this.options = options; observers.add(this); }
    disconnect() { this.target = null; this.records = []; observers.delete(this); }
  }
  const window = new EventTarget();
  const runtime = {
    onMessage: { addListener: listener => messages.add(listener), removeListener: listener => messages.delete(listener) },
    sendMessage: message => {
      assert.equal(message.type, 'GET_AD_BLOCKER_STATE');
      return new Promise(resolve => requests.push(resolve));
    }
  };
  const context = vm.createContext({
    window, document, chrome: { runtime }, MutationObserver, Event, console,
    getComputedStyle: element => ({ display: element.style.display || 'block', visibility: element.style.visibility || 'visible', opacity: element.style.opacity || '1' }),
    Date: class extends Date { static now() { return now; } },
    setTimeout: (callback, delay = 0) => { const id = nextTimer++; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id)
  });
  function run() { vm.runInContext(source, context, { filename: 'youtube.js' }); }
  run();
  async function flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
  async function advance(ms = 150) {
    await flush();
    const end = now + ms;
    let guard = 0;
    while (true) {
      const entry = [...timers].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      if (++guard > 1000) throw new Error('Unbounded controller timer loop');
      const [id, value] = entry;
      now = value.at; timers.delete(id); value.callback(); await flush();
    }
    now = end; await flush();
  }
  function message(value) { let response; for (const listener of messages) listener(value, {}, result => { response = result; }); return response; }
  async function initial(enabled = true) { assert.equal(requests.length, 1, 'controller should request authoritative blocker state'); requests.shift()({ ok: true, enabled }); await advance(); }
  return { document, html, body, player, video, skip, Element, observers, messages, requests, window, initial, advance, message, run };
}

test('waits for authoritative state, then clicks the observed half-opacity Skip button', async () => {
  const f = fixture();
  await f.advance();
  assert.equal(f.skip.clicks, 0);
  assert.equal(f.video.muted, false);
  await f.initial(true);
  assert.equal(f.skip.clicks, 1);
  assert.equal(f.video.muted, true);
  assert.equal(f.html.getAttribute('data-adhunter-youtube-enabled'), 'true');
});

test('normal content remains untouched even when a leftover Skip button exists', async () => {
  const f = fixture({ ad: false });
  await f.initial(true);
  await f.advance(10000);
  assert.equal(f.skip.clicks, 0);
  assert.equal(f.video.muted, false);
});

test('a late initial response cannot override a more recent disable message', async () => {
  const f = fixture();
  f.message({ type: 'AD_BLOCKER_STATE_CHANGED', enabled: false });
  await f.initial(true);
  assert.equal(f.skip.clicks, 0);
  assert.equal(f.video.muted, false);
  assert.equal(f.html.hasAttribute('data-adhunter-youtube-enabled'), false);
});

test('class changes trigger ad handling and restore the prior mute state', async () => {
  const f = fixture({ ad: false });
  await f.initial(true);
  f.player.classList.add('ad-interrupting');
  await f.advance();
  assert.equal(f.skip.clicks, 1);
  assert.equal(f.video.muted, true);
  f.player.classList.remove('ad-interrupting');
  await f.advance();
  assert.equal(f.video.muted, false);
});

test('initially muted videos stay muted on disable', async () => {
  const f = fixture({ muted: true });
  await f.initial(true);
  f.message({ type: 'AD_BLOCKER_STATE_CHANGED', enabled: false });
  assert.equal(f.video.muted, true);
  assert.equal(f.html.hasAttribute('data-adhunter-youtube-enabled'), false);
});

test('disable restores audio and stops pending clicks; enable works independently of the game', async () => {
  const f = fixture();
  await f.initial(true);
  f.message({ type: 'AD_BLOCKER_STATE_CHANGED', enabled: false });
  assert.equal(f.video.muted, false);
  const before = f.skip.clicks;
  await f.advance(10000);
  assert.equal(f.skip.clicks, before);
  f.message({ type: 'AD_BLOCKER_STATE_CHANGED', enabled: true });
  await f.advance();
  assert.equal(f.skip.clicks, before + 1);
});

test('player replacement restores the old video and binds the new player', async () => {
  const f = fixture();
  await f.initial(true);
  f.player.remove();
  const next = f.body.appendChild(new f.Element('div', { id: 'movie_player', class: 'ad-showing' }));
  const video = next.appendChild(new f.Element('video'));
  const skip = next.appendChild(new f.Element('button', { class: 'ytp-skip-ad-button' }));
  await f.advance();
  assert.equal(f.video.muted, false);
  assert.equal(video.muted, true);
  assert.equal(skip.clicks, 1);
});

test('hidden and disabled controls are ignored until they become available', async () => {
  const f = fixture();
  f.skip.setAttribute('aria-disabled', 'true');
  await f.initial(true);
  assert.equal(f.skip.clicks, 0);
  f.skip.removeAttribute('aria-disabled');
  f.skip.setAttribute('hidden', '');
  await f.advance();
  assert.equal(f.skip.clicks, 0);
  f.skip.removeAttribute('hidden');
  await f.advance();
  assert.equal(f.skip.clicks, 1);
});

test('mutation bursts and ineffective clicks remain bounded', async () => {
  const f = fixture();
  await f.initial(true);
  for (let i = 0; i < 100; i++) f.skip.setAttribute('class', 'ytp-skip-ad-button test-' + i);
  await f.advance(30000);
  assert.ok(f.skip.clicks >= 1 && f.skip.clicks <= 6, 'at most six attempts in one uninterrupted ad state');
  const before = f.skip.clicks;
  await f.advance(30000);
  assert.equal(f.skip.clicks, before);
});

test('a control inside an invisible overlay is ignored until the overlay appears', async () => {
  const f = fixture();
  const overlay = f.player.appendChild(new f.Element('div'));
  overlay.style.opacity = '0';
  overlay.appendChild(f.skip);
  await f.initial(true);
  assert.equal(f.skip.clicks, 0);
  overlay.style.opacity = '1';
  overlay.setAttribute('style', 'opacity: 1');
  await f.advance();
  assert.equal(f.skip.clicks, 1);
});

test('document_start before the root exists is supported', async () => {
  const f = fixture({ root: false });
  await f.initial(true);
  assert.equal(f.skip.clicks, 0);
  f.document.appendChild(f.html);
  await f.advance();
  assert.equal(f.skip.clicks, 1);
  assert.equal(f.html.getAttribute('data-adhunter-youtube-enabled'), 'true');
});

test('pagehide cleans up and pageshow checks fresh authoritative state', async () => {
  const f = fixture();
  await f.initial(true);
  f.window.dispatchEvent(new Event('pagehide'));
  assert.equal(f.video.muted, false);
  assert.equal(f.observers.size, 0);
  assert.equal(f.html.hasAttribute('data-adhunter-youtube-enabled'), false);
  const before = f.skip.clicks;
  await f.advance(3000);
  assert.equal(f.skip.clicks, before);
  f.window.dispatchEvent(new Event('pageshow'));
  await f.initial(false);
  assert.equal(f.skip.clicks, before);
});

test('reinjection is a singleton and unknown messages do not claim a response', async () => {
  const f = fixture();
  f.run();
  assert.equal(f.requests.length, 1);
  assert.equal(f.messages.size, 1);
  await f.initial(true);
  assert.equal(f.message({ type: 'UNRELATED_MESSAGE' }), undefined);
  const state = f.message({ type: 'GET_YOUTUBE_AD_STATE' });
  assert.equal(state.ok, true);
  assert.equal(state.enabled, true);
  assert.equal(state.adActive, true);
  assert.equal(state.playerFound, true);
  assert.equal(state.skipAttempts, 1);
});
