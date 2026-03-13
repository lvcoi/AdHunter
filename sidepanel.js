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

// Initial fetch will be done after UI elements are defined


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

const customThickness = document.getElementById('customThickness');
const customColor1 = document.getElementById('customColor1');
const customOpacity1 = document.getElementById('customOpacity1');
const customColor2 = document.getElementById('customColor2');
const customOpacity2 = document.getElementById('customOpacity2');
const customAnimation = document.getElementById('customAnimation');
const customSpeed = document.getElementById('customSpeed');
const customPreview = document.getElementById('customPreview');
const thicknessValue = document.getElementById('thicknessValue');
const speedValue = document.getElementById('speedValue');

function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function updateCustomPreview() {
  if (!customPreview) return;

  const thickness = customThickness.value;
  const color1 = hexToRgba(customColor1.value, customOpacity1.value);
  const color2 = hexToRgba(customColor2.value, customOpacity2.value);
  const animation = customAnimation.value;
  const speed = customSpeed.value;

  thicknessValue.textContent = thickness;
  speedValue.textContent = speed;

  // Reset all inline styles
  customPreview.style.border = 'none';
  customPreview.style.boxShadow = 'none';
  customPreview.style.background = 'transparent';
  customPreview.style.backgroundImage = 'none';
  customPreview.style.animation = 'none';
  customPreview.style.padding = '0';
  customPreview.style.webkitMask = 'none';
  customPreview.style.mask = 'none';
  customPreview.style.opacity = '1';

  if (animation === 'gradient') {
    customPreview.style.padding = `${thickness}px`;
    customPreview.style.background = `conic-gradient(from var(--preview-angle), ${color1} 0deg, ${color2} 180deg, ${color1} 360deg)`;
    customPreview.style.animation = `preview-spin ${speed}s linear infinite`;
    customPreview.style.webkitMask = 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)';
    customPreview.style.webkitMaskComposite = 'xor';
    customPreview.style.maskComposite = 'exclude';
  } else if (animation === 'marching-ants') {
    customPreview.style.background = 'transparent';
    const c1 = customColor1.value;
    customPreview.style.backgroundImage = `
      linear-gradient(90deg, ${c1} 50%, transparent 50%),
      linear-gradient(90deg, ${c1} 50%, transparent 50%),
      linear-gradient(0deg, ${c1} 50%, transparent 50%),
      linear-gradient(0deg, ${c1} 50%, transparent 50%)
    `;
    customPreview.style.backgroundRepeat = 'repeat-x, repeat-x, repeat-y, repeat-y';
    customPreview.style.backgroundSize = `20px ${thickness}px, 20px ${thickness}px, ${thickness}px 20px, ${thickness}px 20px`;
    customPreview.style.backgroundPosition = `0 0, 0 100%, 0 0, 100% 0`;
    customPreview.style.animation = `preview-marching ${speed}s linear infinite`;
    customPreview.style.opacity = customOpacity1.value;
  } else if (animation === 'pulsing') {
    customPreview.style.border = `${thickness}px solid ${color1}`;
    customPreview.style.setProperty('--pulse-color', color2);
    customPreview.style.animation = `preview-pulse ${speed}s ease-out infinite`;
  }
}

[
  customThickness, customColor1, customOpacity1, 
  customColor2, customOpacity2, customAnimation, customSpeed
].forEach(el => {
  if (el) {
    el.addEventListener('input', updateCustomPreview);
    el.addEventListener('change', updateCustomPreview);
  }
});

const saveCustomStyleButton = document.getElementById('saveCustomStyleButton');

if (saveCustomStyleButton) {
  saveCustomStyleButton.addEventListener('click', async () => {
    const customStyleConfig = {
      thickness: customThickness.value,
      color1: customColor1.value,
      opacity1: customOpacity1.value,
      color2: customColor2.value,
      opacity2: customOpacity2.value,
      animation: customAnimation.value,
      speed: customSpeed.value
    };
    try {
      await chrome.storage.sync.set({
        customStyleConfig,
        activeHighlightStyle: 'custom'
      });
      if (highlightStyleSelect) {
        highlightStyleSelect.value = 'custom';
      }
      
      const originalText = saveCustomStyleButton.textContent;
      saveCustomStyleButton.textContent = 'Saved!';
      setTimeout(() => {
        saveCustomStyleButton.textContent = originalText;
      }, 2000);
    } catch (error) {
      console.error('Failed to save custom style:', error);
      alert('Failed to save custom style.');
    }
  });
}

chrome.storage.sync.get({
  activeHighlightStyle: 'rainbow',
  customStyleConfig: null
}, (data) => {
  if (highlightStyleSelect) {
    highlightStyleSelect.value = data.activeHighlightStyle;
  }
  if (data.customStyleConfig) {
    if (customThickness) customThickness.value = data.customStyleConfig.thickness;
    if (customColor1) customColor1.value = data.customStyleConfig.color1;
    if (customOpacity1) customOpacity1.value = data.customStyleConfig.opacity1;
    if (customColor2) customColor2.value = data.customStyleConfig.color2;
    if (customOpacity2) customOpacity2.value = data.customStyleConfig.opacity2;
    if (customAnimation) customAnimation.value = data.customStyleConfig.animation;
    if (customSpeed) customSpeed.value = data.customStyleConfig.speed;
  }
  updateCustomPreview();
  updateSwatches();
});

// Advanced Color Palette Logic
const advancedColorPicker = document.getElementById('advancedColorPicker');
const cpClose = document.getElementById('cpClose');
const cpCurrentColor = document.getElementById('cpCurrentColor');
const cpHexInput = document.getElementById('cpHexInput');
const cpR = document.getElementById('cpR');
const cpRNum = document.getElementById('cpRNum');
const cpG = document.getElementById('cpG');
const cpGNum = document.getElementById('cpGNum');
const cpB = document.getElementById('cpB');
const cpBNum = document.getElementById('cpBNum');
const cpA = document.getElementById('cpA');
const cpANum = document.getElementById('cpANum');

const colorSwatch1 = document.getElementById('colorSwatch1');
const colorSwatch2 = document.getElementById('colorSwatch2');

let activeSwatchIndex = 1;

function hexToRgbVals(hex) {
  if (!hex) return { r: 0, g: 0, b: 0 };
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return { r, g, b };
}

function rgbToHexStr(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function updateSwatches() {
  if (colorSwatch1 && customColor1 && customOpacity1) {
    const {r, g, b} = hexToRgbVals(customColor1.value);
    colorSwatch1.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${customOpacity1.value})`;
  }
  if (colorSwatch2 && customColor2 && customOpacity2) {
    const {r, g, b} = hexToRgbVals(customColor2.value);
    colorSwatch2.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${customOpacity2.value})`;
  }
}

function openColorPicker(index) {
  activeSwatchIndex = index;
  const hexInput = index === 1 ? customColor1 : customColor2;
  const opacityInput = index === 1 ? customOpacity1 : customOpacity2;
  
  const {r, g, b} = hexToRgbVals(hexInput.value);
  const a = parseFloat(opacityInput.value || '1');
  
  cpR.value = cpRNum.value = r;
  cpG.value = cpGNum.value = g;
  cpB.value = cpBNum.value = b;
  cpA.value = cpANum.value = a;
  cpHexInput.value = hexInput.value;
  
  updateColorPickerUI(false);
  if (advancedColorPicker) advancedColorPicker.style.display = 'flex';
}

function closeColorPicker() {
  if (advancedColorPicker) advancedColorPicker.style.display = 'none';
}

function updateColorPickerUI(propagate = true) {
  let r = parseInt(cpR.value) || 0;
  let g = parseInt(cpG.value) || 0;
  let b = parseInt(cpB.value) || 0;
  let a = parseFloat(cpA.value);
  if (isNaN(a)) a = 1;
  
  const hex = rgbToHexStr(r, g, b);
  cpHexInput.value = hex;
  cpCurrentColor.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a})`;
  
  if (propagate) {
    if (activeSwatchIndex === 1) {
      customColor1.value = hex;
      customOpacity1.value = a;
      colorSwatch1.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a})`;
    } else {
      customColor2.value = hex;
      customOpacity2.value = a;
      colorSwatch2.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    updateCustomPreview();
  }
}

if (colorSwatch1) colorSwatch1.addEventListener('click', () => openColorPicker(1));
if (colorSwatch2) colorSwatch2.addEventListener('click', () => openColorPicker(2));
if (cpClose) cpClose.addEventListener('click', closeColorPicker);

[cpR, cpRNum, cpG, cpGNum, cpB, cpBNum, cpA, cpANum].forEach(input => {
  if (input) {
    input.addEventListener('input', (e) => {
      if (e.target.type === 'range') {
        document.getElementById(e.target.id + 'Num').value = e.target.value;
      } else {
        document.getElementById(e.target.id.replace('Num', '')).value = e.target.value;
      }
      updateColorPickerUI(true);
    });
  }
});

if (cpHexInput) {
  cpHexInput.addEventListener('change', (e) => {
    let val = e.target.value;
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/i.test(val)) {
      const {r, g, b} = hexToRgbVals(val);
      cpR.value = cpRNum.value = r;
      cpG.value = cpGNum.value = g;
      cpB.value = cpBNum.value = b;
      updateColorPickerUI(true);
    }
  });
}
