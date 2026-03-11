const STORAGE_KEY = 'removedElementsByTab';

const pickButton = document.getElementById('pickButton');
const stopButton = document.getElementById('stopButton');
const restoreAllButton = document.getElementById('restoreAllButton');
const clearAllButton = document.getElementById('clearAllButton');
const listContainer = document.getElementById('listContainer');
const detailPanel = document.getElementById('detailPanel');
const emptyState = document.getElementById('emptyState');
const itemCount = document.getElementById('itemCount');
const tabMeta = document.getElementById('tabMeta');
const adBlockToggle = document.getElementById('adBlockToggle');
const adBlockLabel = document.getElementById('adBlockLabel');
const highlightStyleSelect = document.getElementById('highlightStyleSelect');

let activeTabId = null;
let activeTabUrl = '';
let selectedRecordId = null;
let records = [];
let adBlockEnabled = false;
let refreshInFlight = false;

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function sendToActiveTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error('No active tab found.');
  }
  activeTabId = tab.id;
  activeTabUrl = tab.url || '';
  return chrome.tabs.sendMessage(tab.id, message);
}

function truncate(text, max = 90) {
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function deleteRecord(recordId) {
  await chrome.runtime.sendMessage({
    type: 'DELETE_REMOVED_ELEMENT_RECORD',
    tabId: activeTabId,
    removeId: recordId
  });
}

function renderAdBlockToggle() {
  adBlockToggle.checked = adBlockEnabled;
  adBlockLabel.textContent = adBlockEnabled ? 'On' : 'Off';
}

async function refreshAdBlockState() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_AD_BLOCKER_STATE' });
  if (response?.ok) {
    adBlockEnabled = Boolean(response.enabled);
    renderAdBlockToggle();
  }
}

async function refresh() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  try { return await refreshInner(); } finally { refreshInFlight = false; }
}

async function refreshInner() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    activeTabId = null;
    activeTabUrl = '';
    records = [];
    render();
    return;
  }

  activeTabId = tab.id;
  activeTabUrl = tab.url || '';
  tabMeta.textContent = `${truncate(tab.title || '(untitled)', 50)} — ${truncate(activeTabUrl, 80)}`;

  const response = await chrome.runtime.sendMessage({
    type: 'GET_REMOVED_ELEMENTS',
    tabId: activeTabId
  });

  records = response?.records || [];

  if (selectedRecordId && !records.some((record) => record.id === selectedRecordId)) {
    selectedRecordId = records[0]?.id || null;
  }
  if (!selectedRecordId && records[0]) {
    selectedRecordId = records[0].id;
  }

  render();
  await refreshAdBlockState();
}

function render() {
  itemCount.textContent = String(records.length);
  emptyState.style.display = records.length ? 'none' : 'block';
  listContainer.replaceChildren();

  for (const record of records) {
    const card = document.createElement('div');
    card.className = `item-card${record.id === selectedRecordId ? ' active' : ''}`;

    const head = document.createElement('div');
    head.className = 'item-head';
    head.innerHTML = `
      <div>
        <div class="selector">${escapeHtml(record.selector)}</div>
        <div class="meta">${escapeHtml(record.tagName)} · ${escapeHtml(record.removedAt)}</div>
      </div>
    `;

    const preview = document.createElement('div');
    preview.className = 'text-preview';
    preview.textContent = record.textPreview || '(no text preview)';

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    const inspectButton = makeButton('Inspect', () => {
      selectedRecordId = record.id;
      render();
    });

    const pingButton = makeButton('Ping selector', async () => {
      try {
        await sendToActiveTab({ type: 'PING_ELEMENT', selector: record.domPath || record.selector });
      } catch (error) {
        console.warn(error);
      }
    });

    const restoreButton = makeButton('Restore', async () => {
      const result = await sendToActiveTab({ type: 'RESTORE_REMOVED_ELEMENT', record });
      if (!result?.ok) {
        alert(result?.error || 'Could not restore that element on this page state.');
        return;
      }
      await deleteRecord(record.id);
      await refresh();
    });

    const deleteButton = makeButton('Forget', async () => {
      await deleteRecord(record.id);
      await refresh();
    });

    actions.append(inspectButton, pingButton, restoreButton, deleteButton);
    card.append(head, preview, actions);
    listContainer.append(card);
  }

  renderDetail();
}

function renderDetail() {
  const record = records.find((item) => item.id === selectedRecordId);
  if (!record) {
    detailPanel.className = 'detail-panel empty-detail';
    detailPanel.textContent = 'Select a removed element to inspect it.';
    return;
  }

  detailPanel.className = 'detail-panel';
  detailPanel.replaceChildren();

  detailPanel.append(
    makeDetailSection('Summary', {
      Selector: record.selector,
      'DOM path': record.domPath,
      'Parent path': record.parentPath,
      'Next sibling path': record.nextSiblingPath,
      'Page title': record.pageTitle,
      URL: record.pageUrl,
      Removed: record.removedAt
    }),
    makeDetailSection('Attributes', record.attributes || {}),
    makeDetailSection('Dataset', record.dataset || {}),
    makeDetailSection('Box snapshot', record.box || {}),
    makeCodeSection('Inline style', record.inlineStyle || '(none)'),
    makeCodeSection('Computed style snapshot', JSON.stringify(record.computedStyle || {}, null, 2)),
    makeCodeSection('Outer HTML', record.outerHTML || '')
  );
}

function makeDetailSection(title, data) {
  const section = document.createElement('section');
  section.className = 'detail-section';

  const heading = document.createElement('h3');
  heading.textContent = title;

  const grid = document.createElement('div');
  grid.className = 'kv-grid';

  const entries = Object.entries(data || {});
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'warning';
    empty.textContent = 'No values captured.';
    section.append(heading, empty);
    return section;
  }

  for (const [key, value] of entries) {
    const row = document.createElement('div');
    row.className = 'kv-row';

    const keyCell = document.createElement('div');
    keyCell.className = 'kv-key';
    keyCell.textContent = key;

    const valueCell = document.createElement('div');
    valueCell.className = 'kv-value';
    valueCell.textContent = typeof value === 'string' ? value : JSON.stringify(value);

    row.append(keyCell, valueCell);
    grid.append(row);
  }

  section.append(heading, grid);
  return section;
}

function makeCodeSection(title, text) {
  const section = document.createElement('section');
  section.className = 'detail-section';

  const heading = document.createElement('h3');
  heading.textContent = title;

  const pre = document.createElement('pre');
  pre.className = 'scroll-code';
  pre.textContent = text;

  section.append(heading, pre);
  return section;
}

function makeButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

pickButton.addEventListener('click', async () => {
  await sendToActiveTab({ type: 'START_PICK_MODE' });
});

stopButton.addEventListener('click', async () => {
  await sendToActiveTab({ type: 'STOP_PICK_MODE' });
});

restoreAllButton.addEventListener('click', async () => {
  for (const record of [...records]) {
    const result = await sendToActiveTab({ type: 'RESTORE_REMOVED_ELEMENT', record });
    if (result?.ok) {
      await deleteRecord(record.id);
    }
  }
  await refresh();
});

clearAllButton.addEventListener('click', async () => {
  if (activeTabId == null) return;
  await chrome.runtime.sendMessage({ type: 'CLEAR_TAB_RECORDS', tabId: activeTabId });
  await refresh();
});


adBlockToggle.addEventListener('change', async () => {
  adBlockToggle.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SET_AD_BLOCKER_STATE',
      enabled: adBlockToggle.checked
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'Could not update ad blocker state.');
    }

    adBlockEnabled = Boolean(response.enabled);
    renderAdBlockToggle();
  } catch (error) {
    console.error(error);
    adBlockToggle.checked = adBlockEnabled;
    renderAdBlockToggle();
    alert(error?.message || 'Could not update ad blocker state.');
  } finally {
    adBlockToggle.disabled = false;
  }
});

chrome.storage.sync.get({ activeHighlightStyle: 'rainbow' }, (data) => {
  if (highlightStyleSelect) {
    highlightStyleSelect.value = data.activeHighlightStyle;
  }
});

highlightStyleSelect.addEventListener('change', async () => {
  try {
    await chrome.storage.sync.set({ activeHighlightStyle: highlightStyleSelect.value });
  } catch (error) {
    console.error('Failed to save highlight style:', error);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[STORAGE_KEY]) {
    refresh().catch(console.error);
  }
});

chrome.tabs.onActivated.addListener(() => {
  refresh().catch(console.error);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === activeTabId && (changeInfo.status === 'complete' || changeInfo.url)) {
    refresh().catch(console.error);
  }
});

refresh().catch(console.error);
