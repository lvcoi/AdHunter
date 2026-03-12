const REMOVED_NODE_MAP = new Map();
const PLACEHOLDER_MAP = new Map();
const OVERLAY_ID = '__element_vault_overlay__';
const SHIELD_ID = '__element_vault_capture_shield__';
const STYLE_ID = '__element_vault_style__';
const PICK_MODE_CLASS = '__element-vault-pick-mode__';

let pickMode = false;
let currentHover = null;
let removeCounter = 0;
let viewportRafPending = false;

let activeHighlightStyle = 'rainbow';
let customStyleConfig = null;

function hexToRgba(hex, opacity) {
  if (!hex) return 'transparent';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function applyCustomStyle(overlay) {
  if (!overlay) return;

  if (activeHighlightStyle !== 'custom' || !customStyleConfig) {
    overlay.style.border = '';
    overlay.style.boxShadow = '';
    overlay.style.background = '';
    overlay.style.backgroundImage = '';
    overlay.style.animation = '';
    overlay.style.padding = '';
    overlay.style.webkitMask = '';
    overlay.style.webkitMaskComposite = '';
    overlay.style.maskComposite = '';
    overlay.style.opacity = '';
    overlay.style.backgroundRepeat = '';
    overlay.style.backgroundSize = '';
    overlay.style.backgroundPosition = '';
    overlay.style.removeProperty('--element-vault-pulse-color');
    return;
  }

  const { thickness = 3, color1 = '#ffffff', opacity1 = 1, color2 = '#000000', opacity2 = 1, animation = 'gradient', speed = 2 } = customStyleConfig;
  const rgba1 = hexToRgba(color1, opacity1);
  const rgba2 = hexToRgba(color2, opacity2);

  overlay.style.border = 'none';
  overlay.style.boxShadow = 'none';
  overlay.style.background = 'transparent';
  overlay.style.backgroundImage = 'none';
  overlay.style.animation = 'none';
  overlay.style.padding = '0';
  overlay.style.webkitMask = 'none';
  overlay.style.webkitMaskComposite = 'source-over';
  overlay.style.maskComposite = 'add';
  overlay.style.opacity = '1';
  overlay.style.backgroundRepeat = 'no-repeat';
  overlay.style.backgroundSize = 'auto';
  overlay.style.backgroundPosition = '0 0';

  if (animation === 'gradient') {
    overlay.style.padding = `${thickness}px`;
    overlay.style.background = `conic-gradient(from var(--element-vault-angle), ${rgba1} 0deg, ${rgba2} 180deg, ${rgba1} 360deg)`;
    overlay.style.animation = `element-vault-spin ${speed}s linear infinite`;
    overlay.style.webkitMask = 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)';
    overlay.style.webkitMaskComposite = 'xor';
    overlay.style.maskComposite = 'exclude';
  } else if (animation === 'marching-ants') {
    overlay.style.background = 'transparent';
    overlay.style.backgroundImage = `
      linear-gradient(90deg, ${color1} 50%, transparent 50%),
      linear-gradient(90deg, ${color1} 50%, transparent 50%),
      linear-gradient(0deg, ${color1} 50%, transparent 50%),
      linear-gradient(0deg, ${color1} 50%, transparent 50%)
    `;
    overlay.style.backgroundRepeat = 'repeat-x, repeat-x, repeat-y, repeat-y';
    overlay.style.backgroundSize = `20px ${thickness}px, 20px ${thickness}px, ${thickness}px 20px, ${thickness}px 20px`;
    overlay.style.backgroundPosition = `0 0, 0 100%, 0 0, 100% 0`;
    overlay.style.animation = `element-vault-marching ${speed}s linear infinite`;
    overlay.style.opacity = opacity1;
  } else if (animation === 'pulsing') {
    overlay.style.border = `${thickness}px solid ${rgba1}`;
    overlay.style.setProperty('--element-vault-pulse-color', rgba2);
    overlay.style.animation = `element-vault-pulse ${speed}s ease-out infinite`;
  }
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @property --element-vault-angle {
      syntax: '<angle>';
      inherits: false;
      initial-value: 0deg;
    }

    @keyframes element-vault-spin {
      to { --element-vault-angle: 360deg; }
    }

    @keyframes element-vault-marching {
      to { background-position: 20px 0, -20px 100%, 0 -20px, 100% 20px; }
    }

    @keyframes element-vault-pulse {
      0% { box-shadow: 0 0 0 0 var(--element-vault-pulse-color); }
      70% { box-shadow: 0 0 0 10px transparent; }
      100% { box-shadow: 0 0 0 0 transparent; }
    }

    #${SHIELD_ID} {
      position: fixed;
      inset: 0;
      display: none;
      pointer-events: auto;
      background: transparent;
      z-index: 2147483646;
      cursor: crosshair !important;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }

    #${OVERLAY_ID} {
      position: fixed;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      pointer-events: none;
      z-index: 2147483647;
      border-radius: 12px;
      display: none;
      box-sizing: border-box;
      will-change: background;
    }

    #${OVERLAY_ID}[data-style="rainbow"] {
      --element-vault-angle: 0deg;
      padding: 3px;
      background: conic-gradient(
        from var(--element-vault-angle),
        #ff3b30 0deg,
        #ff9f0a 70deg,
        #ffd60a 120deg,
        #32d74b 180deg,
        #0a84ff 250deg,
        #5e5ce6 305deg,
        #bf5af2 332deg,
        #ff3b30 360deg
      );
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.14),
        0 0 24px rgba(10,132,255,0.28),
        0 0 38px rgba(191,90,242,0.22);
      animation: element-vault-spin 1.4s linear infinite;
      -webkit-mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
    }

    #${OVERLAY_ID}[data-style="solid-blue"] {
      border: 3px solid #0a84ff;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.14), 0 0 12px rgba(10,132,255,0.5);
      background: transparent;
    }

    #${OVERLAY_ID}[data-style="dashed-red"] {
      border: 3px dashed #ff3b30;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.14), 0 0 12px rgba(255,59,48,0.3);
      background: transparent;
    }

    #${OVERLAY_ID}[data-style="glowing-green"] {
      border: 3px solid #32d74b;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.14), 0 0 24px #32d74b, inset 0 0 12px rgba(50,215,75,0.2);
      background: rgba(50, 215, 75, 0.1);
    }

    html.__element-vault-pick-mode__,
    html.__element-vault-pick-mode__ * {
      cursor: crosshair !important;
    }
  `;

  document.documentElement.appendChild(style);
}

// Read initial style
chrome.storage.sync.get({ activeHighlightStyle: 'rainbow', customStyleConfig: null }, (data) => {
  activeHighlightStyle = data.activeHighlightStyle;
  customStyleConfig = data.customStyleConfig;
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    overlay.setAttribute('data-style', activeHighlightStyle);
    applyCustomStyle(overlay);
  }
});

// Listen for style changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    if (changes.activeHighlightStyle) {
      activeHighlightStyle = changes.activeHighlightStyle.newValue;
    }
    if (changes.customStyleConfig) {
      customStyleConfig = changes.customStyleConfig.newValue;
    }
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.setAttribute('data-style', activeHighlightStyle);
      applyCustomStyle(overlay);
    }
  }
});

function ensureOverlay() {
  injectStyles();

  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('data-style', activeHighlightStyle);
    applyCustomStyle(overlay);
    document.documentElement.appendChild(overlay);
  }
  return overlay;
}

function ensureCaptureShield() {
  injectStyles();

  let shield = document.getElementById(SHIELD_ID);
  if (!shield) {
    shield = document.createElement('div');
    shield.id = SHIELD_ID;

    shield.addEventListener('pointermove', onShieldPointerMove, true);
    shield.addEventListener('pointerdown', swallowEvent, true);
    shield.addEventListener('mousedown', swallowEvent, true);
    shield.addEventListener('mouseup', swallowEvent, true);
    shield.addEventListener('touchstart', swallowEvent, { capture: true, passive: false });
    shield.addEventListener('touchend', swallowEvent, { capture: true, passive: false });
    shield.addEventListener('contextmenu', swallowEvent, true);
    shield.addEventListener('dblclick', swallowEvent, true);
    shield.addEventListener('click', onShieldClick, true);

    document.documentElement.appendChild(shield);
  }

  return shield;
}

function showOverlayForElement(element) {
  if (!element || !element.isConnected) {
    hideOverlay();
    return;
  }

  const rect = element.getBoundingClientRect();
  const overlay = ensureOverlay();
  overlay.style.display = 'block';
  overlay.style.top = `${Math.max(0, rect.top - 3)}px`;
  overlay.style.left = `${Math.max(0, rect.left - 3)}px`;
  overlay.style.width = `${Math.max(0, rect.width + 6)}px`;
  overlay.style.height = `${Math.max(0, rect.height + 6)}px`;
  overlay.style.borderRadius = `${Math.max(8, getNumericRadius(element) + 6)}px`;
}

function getNumericRadius(element) {
  const radius = getComputedStyle(element).borderRadius || '0';
  const match = radius.match(/([\d.]+)/);
  return match ? Number(match[1]) : 0;
}

function hideOverlay() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    overlay.style.display = 'none';
  }
}

function isForbiddenTarget(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return true;
  if (element.id === OVERLAY_ID || element.id === STYLE_ID || element.id === SHIELD_ID) return true;

  const tag = element.tagName.toLowerCase();
  return ['html', 'body', 'head', 'script', 'style', 'link', 'meta', 'title'].includes(tag);
}

function cssEscapeSafe(value) {
  try {
    return CSS.escape(value);
  } catch {
    return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }
}

function getNodePath(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
  if (element.id) return `#${cssEscapeSafe(element.id)}`;

  const segments = [];
  let cursor = element;
  while (cursor && cursor.nodeType === Node.ELEMENT_NODE) {
    const tag = cursor.tagName.toLowerCase();

    if (cursor.id) {
      segments.unshift(`#${cssEscapeSafe(cursor.id)}`);
      break;
    }

    let nth = 1;
    let sibling = cursor;
    while ((sibling = sibling.previousElementSibling)) {
      if (sibling.tagName === cursor.tagName) nth += 1;
    }

    segments.unshift(`${tag}:nth-of-type(${nth})`);
    cursor = cursor.parentElement;

    if (!cursor) break;
    if (cursor === document.documentElement) {
      segments.unshift('html');
      break;
    }
  }

  return segments.join(' > ');
}

function readComputedStyleMap(element) {
  const computed = getComputedStyle(element);
  const out = {};
  for (const propertyName of computed) {
    out[propertyName] = computed.getPropertyValue(propertyName);
  }
  return out;
}

function getAttributesMap(element) {
  const attributes = {};
  for (const attr of element.attributes) {
    attributes[attr.name] = attr.value;
  }
  return attributes;
}

function getFriendlySelector(element) {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = element.classList.length ? `.${[...element.classList].slice(0, 3).join('.')}` : '';
  return `${tag}${id}${classes}`;
}

function snapshotElement(element) {
  const rect = element.getBoundingClientRect();
  const parent = element.parentElement;
  const nextSibling = element.nextElementSibling;

  return {
    id: `removed-${Date.now()}-${++removeCounter}`,
    tagName: element.tagName.toLowerCase(),
    selector: getFriendlySelector(element),
    domPath: getNodePath(element),
    parentPath: getNodePath(parent),
    nextSiblingPath: getNodePath(nextSibling),
    classes: [...element.classList],
    textPreview: (element.innerText || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 240),
    attributes: getAttributesMap(element),
    dataset: { ...element.dataset },
    inlineStyle: element.getAttribute('style') || '',
    computedStyle: readComputedStyleMap(element),
    box: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    },
    outerHTML: element.outerHTML,
    removedAt: new Date().toISOString(),
    pageTitle: document.title,
    pageUrl: location.href
  };
}

function reviveElementFromHTML(outerHTML) {
  const template = document.createElement('template');
  template.innerHTML = outerHTML.trim();
  return template.content.firstElementChild;
}

function removeElement(element) {
  if (isForbiddenTarget(element)) {
    return { ok: false, error: 'That element is protected.' };
  }

  const payload = snapshotElement(element);
  const placeholder = document.createComment(`element-vault:${payload.id}`);

  REMOVED_NODE_MAP.set(payload.id, element);
  PLACEHOLDER_MAP.set(payload.id, placeholder);

  element.replaceWith(placeholder);

  chrome.runtime.sendMessage({
    type: 'STORE_REMOVED_ELEMENT',
    payload
  }).catch((error) => {
    console.error('Failed to store removed element record:', error);
  });

  currentHover = null;
  hideOverlay();

  return { ok: true, payload };
}

function restoreElement(record) {
  if (!record?.id) {
    return { ok: false, error: 'Missing record id.' };
  }

  const placeholder = PLACEHOLDER_MAP.get(record.id);
  const cachedNode = REMOVED_NODE_MAP.get(record.id);

  if (placeholder?.isConnected) {
    const nodeToRestore = cachedNode && !cachedNode.isConnected
      ? cachedNode
      : reviveElementFromHTML(record.outerHTML);
    placeholder.replaceWith(nodeToRestore);
    PLACEHOLDER_MAP.delete(record.id);
    REMOVED_NODE_MAP.delete(record.id);
    return { ok: true };
  }

  let parent = null;
  let nextSibling = null;
  try {
    parent = record.parentPath ? document.querySelector(record.parentPath) : null;
    nextSibling = record.nextSiblingPath ? document.querySelector(record.nextSiblingPath) : null;
  } catch {
    parent = null;
    nextSibling = null;
  }

  const node = cachedNode && !cachedNode.isConnected ? cachedNode : reviveElementFromHTML(record.outerHTML);
  const mount = parent || document.body || document.documentElement;

  if (!mount) {
    return { ok: false, error: 'No insertion point found.' };
  }

  if (nextSibling && nextSibling.parentElement === mount) {
    mount.insertBefore(node, nextSibling);
  } else {
    mount.appendChild(node);
  }

  PLACEHOLDER_MAP.delete(record.id);
  REMOVED_NODE_MAP.delete(record.id);
  return { ok: true, warning: 'Element restored using a DOM path fallback.' };
}

function getTargetFromPoint(clientX, clientY) {
  const shield = ensureCaptureShield();
  const overlay = ensureOverlay();
  const previousShieldPointerEvents = shield.style.pointerEvents;
  const previousOverlayPointerEvents = overlay.style.pointerEvents;

  shield.style.pointerEvents = 'none';
  overlay.style.pointerEvents = 'none';

  let candidates = [];
  if (typeof document.elementsFromPoint === 'function') {
    candidates = document.elementsFromPoint(clientX, clientY) || [];
  } else {
    const single = document.elementFromPoint(clientX, clientY);
    candidates = single ? [single] : [];
  }

  shield.style.pointerEvents = previousShieldPointerEvents || 'auto';
  overlay.style.pointerEvents = previousOverlayPointerEvents || 'none';

  return candidates.find((element) => !isForbiddenTarget(element)) || null;
}

function startPickMode() {
  pickMode = true;
  document.documentElement.classList.add(PICK_MODE_CLASS);
  ensureCaptureShield().style.display = 'block';
}

function stopPickMode() {
  pickMode = false;
  currentHover = null;
  document.documentElement.classList.remove(PICK_MODE_CLASS);
  hideOverlay();

  const shield = document.getElementById(SHIELD_ID);
  if (shield) {
    shield.style.display = 'none';
  }
}

function updateHoverFromPoint(clientX, clientY) {
  if (!pickMode) return;

  const target = getTargetFromPoint(clientX, clientY);
  if (!target) {
    hideOverlay();
    currentHover = null;
    return;
  }

  currentHover = target;
  showOverlayForElement(target);
}

function onShieldPointerMove(event) {
  if (!pickMode) return;
  swallowEvent(event);
  updateHoverFromPoint(event.clientX, event.clientY);
}

function onShieldClick(event) {
  if (!pickMode) return;
  swallowEvent(event);

  const target = getTargetFromPoint(event.clientX, event.clientY) || currentHover;
  if (!target || isForbiddenTarget(target)) {
    return;
  }

  removeElement(target);
}

function swallowEvent(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function onKeyDown(event) {
  if (!pickMode) return;
  if (event.key === 'Escape') {
    stopPickMode();
  }
}

function onViewportChange() {
  if (!pickMode || viewportRafPending) return;
  viewportRafPending = true;
  requestAnimationFrame(() => {
    viewportRafPending = false;
    if (!pickMode) return;
    if (!currentHover || !currentHover.isConnected) {
      currentHover = null;
      hideOverlay();
      return;
    }
    showOverlayForElement(currentHover);
  });
}

function clearTransientState() {
  stopPickMode();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    switch (message?.type) {
      case 'START_PICK_MODE':
        startPickMode();
        sendResponse({ ok: true });
        break;

      case 'STOP_PICK_MODE':
        stopPickMode();
        sendResponse({ ok: true });
        break;

      case 'RESTORE_REMOVED_ELEMENT': {
        const result = restoreElement(message.record);
        sendResponse(result);
        break;
      }

      case 'PING_ELEMENT': {
        let element = null;
        try {
          element = message.selector ? document.querySelector(message.selector) : null;
        } catch {
          element = null;
        }

        if (element) {
          showOverlayForElement(element);
          setTimeout(hideOverlay, 1200);
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: 'Element not found in current DOM.' });
        }
        break;
      }

      default:
        sendResponse({ ok: false, error: 'Unknown message type.' });
    }
  } catch (error) {
    console.error(error);
    sendResponse({ ok: false, error: error?.message || 'Unexpected content-script error.' });
  }

  return true;
});

document.addEventListener('keydown', onKeyDown, true);
window.addEventListener('pagehide', clearTransientState);
window.addEventListener('scroll', onViewportChange, true);
window.addEventListener('resize', onViewportChange, true);
