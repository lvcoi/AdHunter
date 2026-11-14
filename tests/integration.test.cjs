const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = process.env.ADHUNTER_TEST_ROOT || path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

function backgroundFixture({ failUpdate = false, failUpdateOnce = false, rejectReceiver = false, deferFirstQuery = false } = {}) {
  let messageHandler;
  let enabled = true;
  const delivered = [];
  const queries = [];
  let releaseFirstQuery;
  let announceFirstQuery;
  const queryGate = new Promise(resolve => { releaseFirstQuery = resolve; });
  const firstQueryStarted = new Promise(resolve => { announceFirstQuery = resolve; });
  const noListener = { addListener() {} };
  const chrome = {
    runtime: { onInstalled: noListener, onMessage: { addListener(fn) { messageHandler = fn; } } },
    sidePanel: { async setPanelBehavior() {} },
    declarativeNetRequest: {
      async getEnabledRulesets() { return enabled ? ['adblock_rules'] : []; },
      async updateEnabledRulesets(options) {
        if (failUpdate || failUpdateOnce) {
          failUpdateOnce = false;
          throw new Error('DNR update failed');
        }
        enabled = Boolean(options.enableRulesetIds?.includes('adblock_rules'));
      }
    },
    tabs: {
      onUpdated: noListener, onRemoved: noListener,
      async query(options) {
        queries.push(options);
        if (queries.length === 1) {
          announceFirstQuery();
          if (deferFirstQuery) await queryGate;
        }
        return [{ id: 7 }, { id: 9 }];
      },
      async sendMessage(tabId, message) {
        delivered.push({ tabId, message });
        if (rejectReceiver && tabId === 7) throw new Error('No receiver');
        return { ok: true };
      }
    }
  };
  vm.runInNewContext(read('background.js'), { chrome, console: { error() {}, warn() {} } });
  return {
    delivered, queries, releaseFirstQuery, firstQueryStarted,
    request(message) { return new Promise(resolve => messageHandler(message, {}, resolve)); },
    get enabled() { return enabled; }
  };
}

test('turning the blocker off updates both DNR and existing YouTube tabs', async () => {
  const f = backgroundFixture();
  const response = await f.request({ type: 'SET_AD_BLOCKER_STATE', enabled: false });
  assert.equal(response.ok, true);
  assert.equal(response.enabled, false);
  assert.equal(f.enabled, false);
  assert.deepEqual(JSON.parse(JSON.stringify(f.delivered)), [
    { tabId: 7, message: { type: 'AD_BLOCKER_STATE_CHANGED', enabled: false } },
    { tabId: 9, message: { type: 'AD_BLOCKER_STATE_CHANGED', enabled: false } }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(f.queries)), [
    { url: ['https://www.youtube.com/*', 'https://youtube.com/*'] }
  ]);
});

test('a tab with no content-script receiver does not roll back the toggle', async () => {
  const f = backgroundFixture({ rejectReceiver: true });
  const response = await f.request({ type: 'SET_AD_BLOCKER_STATE', enabled: true });
  assert.equal(response.ok, true);
  assert.equal(f.delivered.length, 2);
  assert.equal(f.enabled, true);
});

test('a failed network-rules update does not announce a false state', async () => {
  const f = backgroundFixture({ failUpdate: true });
  const response = await f.request({ type: 'SET_AD_BLOCKER_STATE', enabled: false });
  assert.equal(response.ok, false);
  assert.equal(f.enabled, true);
  assert.equal(f.delivered.length, 0);
});

test('overlapping toggles keep tab notifications ordered with the final DNR state', async () => {
  const f = backgroundFixture({ deferFirstQuery: true });
  const first = f.request({ type: 'SET_AD_BLOCKER_STATE', enabled: true });
  await f.firstQueryStarted;
  const second = f.request({ type: 'SET_AD_BLOCKER_STATE', enabled: false });
  // Let the competing operation run its microtasks before releasing the first
  // tab query; an unserialized implementation broadcasts false, then true.
  await new Promise(setImmediate);
  f.releaseFirstQuery();
  await Promise.all([first, second]);
  assert.equal(f.enabled, false);
  assert.deepEqual(f.delivered.filter(x => x.tabId === 7).map(x => x.message.enabled), [true, false]);
});

test('a rejected toggle does not prevent subsequent queued toggles', async () => {
  const f = backgroundFixture({ failUpdateOnce: true });
  const first = await f.request({ type: 'SET_AD_BLOCKER_STATE', enabled: false });
  const second = await f.request({ type: 'SET_AD_BLOCKER_STATE', enabled: false });
  assert.equal(first.ok, false);
  assert.equal(second.ok, true);
  assert.equal(f.enabled, false);
  assert.equal(f.delivered.length, 2);
});

function adElement(relation = 'unrelated') {
  const classes = new Set();
  const element = {
    relation, isConnected: true, tagName: 'DIV', innerText: 'Sponsored', innerHTML: '<img alt="">',
    style: {},
    classList: { add(x) { classes.add(x); }, remove(x) { classes.delete(x); }, contains(x) { return classes.has(x); } },
    getBoundingClientRect() { return { x: 16, y: 68, left: 16, top: 68, width: 946, height: 532 }; },
    closest() { return ['player', 'inside-player'].includes(this.relation) ? this : null; },
    querySelector() { return this.relation === 'contains-player' ? this : null; }
  };
  return element;
}

function contentFixture(elements, hostname = 'www.youtube.com') {
  const handlers = [];
  const timers = [];
  const window = {};
  const chrome = {
    runtime: { onMessage: { addListener(fn) { handlers.push(fn); } } },
    storage: { sync: { get() {} }, onChanged: { addListener() {} } }
  };
  const document = {
    querySelectorAll() { return elements; },
    getElementById() { return null; },
    createElement() { return { style: {}, id: '', parentNode: {}, appendChild() {}, addEventListener() {} }; },
    body: { appendChild() {} },
    documentElement: { appendChild() {} }
  };
  // Expose private entry points in the test loader only. The production file
  // remains unmodified; the real detector, queue and delayed hide run below.
  const instrumented = read('content.js').replace('} // end re-injection guard', `
    window.__fixture = {
      detect() {
        duckAdsEnabled = true;
        currentWaveProcessing = true;
        pendingAdQueue = [];
        trackedAdSlots.clear();
        detectAdSlots();
        return pendingAdQueue;
      },
      spawn(element) {
        duckAdsEnabled = true;
        currentWaveProcessing = true;
        pendingAdQueue = [];
        spawnDuckInSlot(element);
      },
      stop() { duckAdsEnabled = false; }
    };
  } // end re-injection guard`);
  vm.runInNewContext(instrumented, {
    window, document, chrome, location: { hostname }, console, performance,
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout() {}, setInterval() {}, clearInterval() {}, requestAnimationFrame() {}
  });
  return { handlers, timers, ...window.__fixture };
}

test('the duck detector excludes a YouTube player, its children and its containers', () => {
  const player = adElement('player');
  const child = adElement('inside-player');
  const parent = adElement('contains-player');
  const realSlot = adElement();
  const f = contentFixture([player, child, parent, realSlot]);
  assert.deepEqual(Array.from(f.detect()), [realSlot]);
});

test('queued slots are checked again before the game hides them', () => {
  const player = adElement('player');
  const f = contentFixture([player]);
  f.spawn(player);
  assert.equal(f.timers.length, 0);
  assert.equal(player.style.visibility, undefined);
  assert.equal(player.classList.contains('duckads-disintegrate-anim'), false);
});

test('a slot that becomes a player container during the animation stays visible', () => {
  const slot = adElement();
  const f = contentFixture([slot]);
  f.spawn(slot);
  assert.equal(f.timers.length, 1);
  slot.relation = 'contains-player';
  f.timers[0]();
  assert.equal(slot.style.visibility, undefined);
  assert.equal(slot.classList.contains('duckads-disintegrate-anim'), false);
});

test('stopping the game before its timer fires does not hide the pending slot', () => {
  const slot = adElement();
  const f = contentFixture([slot]);
  f.spawn(slot);
  f.stop();
  f.timers[0]();
  assert.equal(slot.style.visibility, undefined);
});

test('the generic content listener leaves YouTube-specific messages unanswered', () => {
  const f = contentFixture([]);
  const replies = [];
  const keepChannelOpen = f.handlers[0]({ type: 'GET_YOUTUBE_AD_STATE' }, {}, value => replies.push(value));
  assert.equal(keepChannelOpen, false);
  assert.deepEqual(replies, []);
});
