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
const customAnimation = document.getElementById('customAnimation');
const customSpeed = document.getElementById('customSpeed');
const customPreview = document.getElementById('customPreview');
const thicknessValue = document.getElementById('thicknessValue');
const speedValue = document.getElementById('speedValue');

let gradientStops = [
  { color: '#ff3b30', opacity: 1, position: 0 },
  { color: '#0a84ff', opacity: 1, position: 100 }
];
let activeMarkerIndex = -1;

const gradientBarContainer = document.getElementById('gradientBarContainer');
const gradientBar = document.getElementById('gradientBar');
const gradientMarkers = document.getElementById('gradientMarkers');
const removeMarkerBtn = document.getElementById('removeMarkerBtn');

function hexToRgba(colorStr, opacity) {
  const parsed = parseColorStr(colorStr);
  if (!parsed) return `rgba(0, 0, 0, ${opacity !== undefined ? opacity : 1})`;
  const explicitAlpha = (opacity !== undefined && opacity !== null) ? opacity : 1;
  const finalAlpha = parsed.a !== 1 ? parsed.a : explicitAlpha;
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${finalAlpha})`;
}

function renderGradientBar() {
  if (!gradientBar || !gradientMarkers) return;

  gradientStops.sort((a, b) => a.position - b.position);

  const linearStops = gradientStops.map(stop => `${hexToRgba(stop.color, stop.opacity)} ${stop.position}%`).join(', ');
  gradientBar.style.background = `linear-gradient(90deg, ${linearStops})`;

  gradientMarkers.innerHTML = '';
  gradientStops.forEach((stop, index) => {
    const marker = document.createElement('div');
    marker.className = `gradient-marker${index === activeMarkerIndex ? ' active' : ''}`;
    marker.style.left = `${stop.position}%`;
    marker.style.setProperty('--marker-color', hexToRgba(stop.color, stop.opacity));
    
    marker.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      activeMarkerIndex = index;
      renderGradientBar();
      openColorPicker(index);
      
      const containerRect = gradientBarContainer.getBoundingClientRect();
      const onMouseMove = (moveEvent) => {
        let newPos = ((moveEvent.clientX - containerRect.left) / containerRect.width) * 100;
        newPos = Math.max(0, Math.min(100, newPos));
        gradientStops[activeMarkerIndex].position = newPos;
        renderGradientBar();
        updateCustomPreview();
      };
      
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        gradientStops.sort((a, b) => a.position - b.position);
        activeMarkerIndex = gradientStops.findIndex(s => s === stop);
        renderGradientBar();
        updateCustomPreview();
      };
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
    
    gradientMarkers.appendChild(marker);
  });
  
  if (removeMarkerBtn) {
    removeMarkerBtn.style.display = (activeMarkerIndex !== -1 && gradientStops.length > 2) ? 'block' : 'none';
  }
}

if (gradientBarContainer) {
  gradientBarContainer.addEventListener('mousedown', (e) => {
    const containerRect = gradientBarContainer.getBoundingClientRect();
    let newPos = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    newPos = Math.max(0, Math.min(100, newPos));
    
    const newStop = { color: '#ffffff', opacity: 1, position: newPos };
    gradientStops.push(newStop);
    gradientStops.sort((a, b) => a.position - b.position);
    activeMarkerIndex = gradientStops.indexOf(newStop);
    
    renderGradientBar();
    updateCustomPreview();
    openColorPicker(activeMarkerIndex);
  });
}

if (removeMarkerBtn) {
  removeMarkerBtn.addEventListener('click', () => {
    if (activeMarkerIndex !== -1 && gradientStops.length > 2) {
      gradientStops.splice(activeMarkerIndex, 1);
      activeMarkerIndex = -1;
      closeColorPicker();
      renderGradientBar();
      updateCustomPreview();
    }
  });
}

function updateCustomPreview() {
  if (!customPreview) return;

  const thickness = customThickness.value;
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

  gradientStops.sort((a, b) => a.position - b.position);

  if (animation === 'gradient') {
    const conicStops = gradientStops.map(stop => `${hexToRgba(stop.color, stop.opacity)} ${stop.position * 3.6}deg`).join(', ');
    const firstStopColor = hexToRgba(gradientStops[0].color, gradientStops[0].opacity);
    customPreview.style.padding = `${thickness}px`;
    customPreview.style.background = `conic-gradient(from var(--preview-angle), ${conicStops}, ${firstStopColor} 360deg)`;
    customPreview.style.animation = `preview-spin ${speed}s linear infinite`;
    customPreview.style.webkitMask = 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)';
    customPreview.style.webkitMaskComposite = 'xor';
    customPreview.style.maskComposite = 'exclude';
    } else if (animation.startsWith('level-')) {
    const level = parseInt(animation.split('-')[1]);
    const color1 = hexToRgba(gradientStops[0].color, gradientStops[0].opacity);
    const color2 = gradientStops.length > 1 ? hexToRgba(gradientStops[1].color, gradientStops[1].opacity) : color1;
    
    customPreview.style.background = 'transparent';
    customPreview.style.border = 'none';
    customPreview.style.boxShadow = 'none';
    customPreview.style.webkitMask = 'none';
    customPreview.style.mask = 'none';
    customPreview.style.padding = '0';
    customPreview.style.backgroundImage = 'none';

    switch (level) {
      case 1:
        customPreview.style.background = `linear-gradient(270deg, ${color1}, ${color2})`;
        customPreview.style.backgroundSize = '400% 400%';
        customPreview.style.animation = `preview-bg-move ${speed}s ease infinite`;
        break;
      case 2:
        customPreview.style.background = `repeating-linear-gradient(45deg, ${color1}, ${color1} 10px, ${color2} 10px, ${color2} 20px)`;
        customPreview.style.backgroundSize = '200% 200%';
        customPreview.style.animation = `preview-diagonal ${speed}s linear infinite`;
        break;
      case 3:
        customPreview.style.border = `${thickness}px solid ${color1}`;
        customPreview.style.animation = `preview-breathe ${speed}s ease-in-out infinite alternate`;
        break;
      case 4:
        customPreview.style.padding = `${thickness}px`;
        customPreview.style.background = `conic-gradient(from var(--preview-angle), ${color1}, ${color2}, ${color1})`;
        customPreview.style.webkitMask = 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)';
        customPreview.style.webkitMaskComposite = 'xor';
        customPreview.style.maskComposite = 'exclude';
        customPreview.style.animation = `preview-radar ${speed}s linear infinite`;
        break;
      case 5:
        customPreview.style.border = `${thickness}px dashed ${color1}`;
        customPreview.style.animation = `preview-breathe ${speed}s linear infinite`;
        break;
      case 6:
        customPreview.style.border = `${thickness}px solid ${color1}`;
        customPreview.style.setProperty('--pulse-color', color1);
        customPreview.style.setProperty('--pulse-color-alt', color2);
        customPreview.style.animation = `preview-double-pulse ${speed}s ease-out infinite`;
        break;
      case 7:
        customPreview.style.border = `${thickness}px solid ${color1}`;
        customPreview.style.setProperty('--pulse-color', color1);
        customPreview.style.animation = `preview-flicker ${speed}s infinite`;
        break;
      case 8:
        customPreview.style.border = `${thickness}px solid ${color1}`;
        customPreview.style.animation = `preview-glitch ${speed}s linear infinite`;
        break;
      case 9:
        customPreview.style.border = `${thickness}px solid ${color1}`;
        customPreview.style.setProperty('--pulse-color', color1);
        customPreview.style.animation = `preview-ripple ${speed}s ease-out infinite`;
        break;
      case 10:
        customPreview.style.border = `${thickness}px solid ${color1}`;
        customPreview.style.animation = `preview-chaos ${speed}s infinite`;
        break;
    }
  } else if (animation === 'pulsing') {
    const color1 = hexToRgba(gradientStops[0].color, gradientStops[0].opacity);
    const color2 = gradientStops.length > 1 ? hexToRgba(gradientStops[1].color, gradientStops[1].opacity) : color1;
    customPreview.style.border = `${thickness}px solid ${color1}`;
    customPreview.style.setProperty('--pulse-color', color2);
    customPreview.style.animation = `preview-pulse ${speed}s ease-out infinite`;
  }
}

[
  customThickness, customAnimation, customSpeed
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
      colors: gradientStops,
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
    if (customAnimation) customAnimation.value = data.customStyleConfig.animation;
    if (customSpeed) customSpeed.value = data.customStyleConfig.speed;
    
    // Migrate old format or load new format
    if (data.customStyleConfig.colors) {
      gradientStops = data.customStyleConfig.colors;
    } else if (data.customStyleConfig.color1) {
      gradientStops = [
        { color: data.customStyleConfig.color1, opacity: data.customStyleConfig.opacity1 || 1, position: 0 },
        { color: data.customStyleConfig.color2, opacity: data.customStyleConfig.opacity2 || 1, position: 100 }
      ];
    }
  }
  renderGradientBar();
  updateCustomPreview();
  if (gradientStops && gradientStops.length > 0) {
    openColorPicker(0);
  }
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

function parseColorStr(val) {
  if (!val) return null;
  val = val.trim();
  let r = 0, g = 0, b = 0, a = 1;

  // Try parsing rgba() or rgb() with numbers or percentages, supporting both comma and space separators (e.g. rgb(255 0 0 / 0.5))
  const rgbaMatch = val.match(/rgba?\s*\(\s*([\d.]+%?)(?:\s*,\s*|\s+)([\d.]+%?)(?:\s*,\s*|\s+)([\d.]+%?)(?:(?:\s*,\s*|\s*\/\s*)([\d.]+%?))?\s*\)/i);
  if (rgbaMatch) {
    const parseChannel = (str) => str.endsWith('%') ? Math.round(parseFloat(str) * 2.55) : parseInt(str, 10);
    r = Math.min(255, Math.max(0, parseChannel(rgbaMatch[1])));
    g = Math.min(255, Math.max(0, parseChannel(rgbaMatch[2])));
    b = Math.min(255, Math.max(0, parseChannel(rgbaMatch[3])));
    if (rgbaMatch[4] !== undefined) {
      const alphaStr = rgbaMatch[4];
      a = alphaStr.endsWith('%') ? parseFloat(alphaStr) / 100 : parseFloat(alphaStr);
      a = Math.min(1, Math.max(0, a));
    }
    return { r, g, b, a };
  }

  // Handle Hex
  if (!val.startsWith('#') && /^[0-9A-Fa-f]{3,8}$/.test(val)) {
    val = '#' + val;
  }
  
  if (/^#[0-9A-Fa-f]{3}$/i.test(val)) {
    r = parseInt(val[1] + val[1], 16);
    g = parseInt(val[2] + val[2], 16);
    b = parseInt(val[3] + val[3], 16);
    return { r, g, b, a: 1 };
  } else if (/^#[0-9A-Fa-f]{4}$/i.test(val)) {
    r = parseInt(val[1] + val[1], 16);
    g = parseInt(val[2] + val[2], 16);
    b = parseInt(val[3] + val[3], 16);
    a = parseInt(val[4] + val[4], 16) / 255;
    return { r, g, b, a: Number(a.toFixed(2)) };
  } else if (/^#[0-9A-Fa-f]{6}$/i.test(val)) {
    r = parseInt(val.slice(1, 3), 16);
    g = parseInt(val.slice(3, 5), 16);
    b = parseInt(val.slice(5, 7), 16);
    return { r, g, b, a: 1 };
  } else if (/^#[0-9A-Fa-f]{8}$/i.test(val)) {
    r = parseInt(val.slice(1, 3), 16);
    g = parseInt(val.slice(3, 5), 16);
    b = parseInt(val.slice(5, 7), 16);
    a = parseInt(val.slice(7, 9), 16) / 255;
    return { r, g, b, a: Number(a.toFixed(2)) };
  }

  return null;
}



function rgbToHexStr(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function openColorPicker(index) {
  activeMarkerIndex = index;
  const stop = gradientStops[index];
  if (!stop) return;
  
  let parsed = parseColorStr(stop.color);
  if (!parsed) parsed = { r: 0, g: 0, b: 0, a: 1 };
  
  const r = parsed.r;
  const g = parsed.g;
  const b = parsed.b;
  const a = parsed.a !== 1 ? parsed.a : (stop.opacity !== undefined ? parseFloat(stop.opacity) : 1);
  
  cpR.value = cpRNum.value = r;
  cpG.value = cpGNum.value = g;
  cpB.value = cpBNum.value = b;
  cpA.value = cpANum.value = a;
  
  if (cpHexInput) cpHexInput.value = stop.color;
  updateColorPickerUI(false, 'hex');
  if (advancedColorPicker) advancedColorPicker.style.display = 'flex';
}

function closeColorPicker() {
  if (advancedColorPicker) advancedColorPicker.style.display = 'none';
  activeMarkerIndex = -1;
  renderGradientBar();
}

function updateColorPickerUI(propagate = true, source = null) {
  let r = parseInt(cpRNum.value);
  if (isNaN(r)) r = 0;
  let g = parseInt(cpGNum.value);
  if (isNaN(g)) g = 0;
  let b = parseInt(cpBNum.value);
  if (isNaN(b)) b = 0;
  let a = parseFloat(cpANum.value);
  if (isNaN(a)) a = 1;
  
  const hex = rgbToHexStr(r, g, b);
  
  if (source !== 'hex') {
    if (a === 1) {
      cpHexInput.value = hex;
    } else {
      cpHexInput.value = `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }
  
  cpCurrentColor.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a})`;
  const btn = document.getElementById('buttonPreview');
  if (btn) btn.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a})`;
  
  if (propagate) {
    if (activeMarkerIndex === -1 && gradientStops.length > 0) {
      activeMarkerIndex = 0;
    }
    if (activeMarkerIndex !== -1 && gradientStops[activeMarkerIndex]) {
      gradientStops[activeMarkerIndex].color = source === 'hex' ? cpHexInput.value : (a === 1 ? hex : `rgba(${r}, ${g}, ${b}, ${a})`);
      gradientStops[activeMarkerIndex].opacity = a;
      renderGradientBar();
      updateCustomPreview();
    }
  }
}

if (cpClose) cpClose.addEventListener('click', closeColorPicker);

[cpR, cpRNum, cpG, cpGNum, cpB, cpBNum, cpA, cpANum].forEach(input => {
  if (input) {
    ['input', 'change'].forEach(evt => {
      input.addEventListener(evt, (e) => {
        if (e.target.type === 'range') {
          document.getElementById(e.target.id + 'Num').value = e.target.value;
        } else {
          document.getElementById(e.target.id.replace('Num', '')).value = e.target.value;
        }
        updateColorPickerUI(true, 'slider');
      });
    });
  }
});

if (cpHexInput) {
  ['input', 'change'].forEach(evt => {
    cpHexInput.addEventListener(evt, (e) => {
      const parsed = parseColorStr(e.target.value);
      if (parsed) {
        cpR.value = cpRNum.value = parsed.r;
        cpG.value = cpGNum.value = parsed.g;
        cpB.value = cpBNum.value = parsed.b;
        cpA.value = cpANum.value = parsed.a;
        updateColorPickerUI(true, 'hex');
      }
    });
  });
}
