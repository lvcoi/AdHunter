const REMOVED_NODE_MAP = new Map();
const PLACEHOLDER_MAP = new Map();
const MAX_STORED_ELEMENTS = 100;

function enforceMapSizeLimit() {
  if (REMOVED_NODE_MAP.size > MAX_STORED_ELEMENTS) {
    const oldestKey = REMOVED_NODE_MAP.keys().next().value;
    if (oldestKey) {
      REMOVED_NODE_MAP.delete(oldestKey);
      PLACEHOLDER_MAP.delete(oldestKey);
    }
  }
}
const OVERLAY_ID = '__element_vault_overlay__';
const SHIELD_ID = '__element_vault_capture_shield__';
const STYLE_ID = '__element_vault_style__';
const PICK_MODE_CLASS = '__element-vault-pick-mode__';

let pickMode = false;
let currentHover = null;
let removeCounter = 0;
let viewportRafPending = false;

let activeHighlightStyle = 'rainbow';

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

    @keyframes element-vault-bg-move { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
    @keyframes element-vault-diagonal { to { background-position: 100% 100%; } }
    @keyframes element-vault-breathe { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.02); opacity: 1; } }
    @keyframes element-vault-radar { to { --element-vault-angle: 360deg; } }
    @keyframes element-vault-double-pulse { 0% { box-shadow: 0 0 0 0 var(--element-vault-pulse-color); } 50% { box-shadow: 0 0 0 10px transparent, 0 0 0 0 var(--element-vault-pulse-color-alt); } 100% { box-shadow: 0 0 0 20px transparent, 0 0 0 10px transparent; } }
    @keyframes element-vault-flicker { 0%, 100% { opacity: 1; box-shadow: 0 0 10px var(--element-vault-pulse-color); } 33% { opacity: 0.4; box-shadow: 0 0 2px var(--element-vault-pulse-color); } 66% { opacity: 0.8; box-shadow: 0 0 15px var(--element-vault-pulse-color); } }
    @keyframes element-vault-glitch { 0% { clip-path: inset(0 0 0 0); } 20% { clip-path: inset(10% 0 80% 0); transform: translateX(-2px); } 40% { clip-path: inset(60% 0 10% 0); transform: translateX(2px); } 60% { clip-path: inset(20% 0 50% 0); transform: translateX(-1px); } 80% { clip-path: inset(80% 0 5% 0); transform: translateX(1px); } 100% { clip-path: inset(0 0 0 0); } }
    @keyframes element-vault-ripple { 0% { box-shadow: 0 0 0 0 var(--element-vault-pulse-color); } 100% { box-shadow: 0 0 0 15px transparent; border-radius: 50%; } }
    @keyframes element-vault-chaos { 0% { filter: hue-rotate(0deg) contrast(100%); transform: skew(0deg, 0deg) scale(1); } 25% { filter: hue-rotate(90deg) contrast(150%); transform: skew(-5deg, 5deg) scale(1.05); } 50% { filter: hue-rotate(180deg) contrast(200%); transform: skew(5deg, -5deg) scale(0.95); } 75% { filter: hue-rotate(270deg) contrast(150%); transform: skew(-2deg, 2deg) scale(1.02); } 100% { filter: hue-rotate(360deg) contrast(100%); transform: skew(0deg, 0deg) scale(1); } }

    @keyframes element-vault-pulse {
      0% { box-shadow: 0 0 0 0 var(--element-vault-pulse-color, transparent); }
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

let customStyleConfig = null;

function updateCustomStyleRule() {
  let styleEl = document.getElementById(STYLE_ID + '_custom');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID + '_custom';
    document.documentElement.appendChild(styleEl);
  }

  if (!customStyleConfig) {
    styleEl.textContent = '';
    return;
  }

  const rawThickness = customStyleConfig.thickness;
  const rawSpeed = customStyleConfig.speed;
  const animation = customStyleConfig.animation;
  const thickness = isNaN(parseFloat(rawThickness)) ? 3 : parseFloat(rawThickness);
  const speed = isNaN(parseFloat(rawSpeed)) ? 1 : parseFloat(rawSpeed);
  let gradientStops = customStyleConfig.colors || [
    { color: customStyleConfig.color1 || '#ff3b30', opacity: customStyleConfig.opacity1 || 1, position: 0 },
    { color: customStyleConfig.color2 || '#0a84ff', opacity: customStyleConfig.opacity2 || 1, position: 100 }
  ];
  
    function hexToRgba(colorStr, opacity) {
    if (!colorStr) return `rgba(255,255,255,${opacity})`;
    colorStr = colorStr.trim();
    const explicitAlpha = (opacity !== undefined && opacity !== null) ? parseFloat(opacity) : 1;
    
    const rgbaMatch = colorStr.match(/rgba?\s*\(\s*([\d.]+%?)(?:\s*,\s*|\s+)([\d.]+%?)(?:\s*,\s*|\s+)([\d.]+%?)(?:(?:\s*,\s*|\s*\/\s*)([\d.]+%?))?\s*\)/i);
    if (rgbaMatch) {
      const parseChannel = (str) => str.endsWith('%') ? Math.round(parseFloat(str) * 2.55) : parseInt(str, 10);
      const r = Math.min(255, Math.max(0, parseChannel(rgbaMatch[1])));
      const g = Math.min(255, Math.max(0, parseChannel(rgbaMatch[2])));
      const b = Math.min(255, Math.max(0, parseChannel(rgbaMatch[3])));
      let a = explicitAlpha;
      if (rgbaMatch[4] !== undefined) {
        const alphaStr = rgbaMatch[4];
        const parsedA = alphaStr.endsWith('%') ? parseFloat(alphaStr) / 100 : parseFloat(alphaStr);
        a = parsedA !== 1 ? parsedA : explicitAlpha;
      }
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    
    if (!colorStr.startsWith('#') && /^[0-9A-Fa-f]{3,8}$/.test(colorStr)) colorStr = '#' + colorStr;
    let r = 0, g = 0, b = 0, a = explicitAlpha;
    if (/^#[0-9A-Fa-f]{3}$/i.test(colorStr)) {
      r = parseInt(colorStr[1] + colorStr[1], 16); g = parseInt(colorStr[2] + colorStr[2], 16); b = parseInt(colorStr[3] + colorStr[3], 16);
    } else if (/^#[0-9A-Fa-f]{4}$/i.test(colorStr)) {
      r = parseInt(colorStr[1] + colorStr[1], 16); g = parseInt(colorStr[2] + colorStr[2], 16); b = parseInt(colorStr[3] + colorStr[3], 16); a = parseInt(colorStr[4] + colorStr[4], 16) / 255;
    } else if (/^#[0-9A-Fa-f]{6}$/i.test(colorStr)) {
      r = parseInt(colorStr.slice(1, 3), 16); g = parseInt(colorStr.slice(3, 5), 16); b = parseInt(colorStr.slice(5, 7), 16);
    } else if (/^#[0-9A-Fa-f]{8}$/i.test(colorStr)) {
      r = parseInt(colorStr.slice(1, 3), 16); g = parseInt(colorStr.slice(3, 5), 16); b = parseInt(colorStr.slice(5, 7), 16); a = parseInt(colorStr.slice(7, 9), 16) / 255;
    }
    
    a = a !== 1 ? a : explicitAlpha;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  gradientStops.sort((a, b) => a.position - b.position);

  let css = `#${OVERLAY_ID}[data-style="custom"] {
    border: none;
    box-shadow: none;
    background: transparent;
    background-image: none;
    animation: none;
    padding: 0;
    -webkit-mask: none;
    mask: none;
    opacity: 1;
`;

  if (animation === 'gradient') {
    const conicStops = gradientStops.map(stop => `${hexToRgba(stop.color, stop.opacity)} ${stop.position * 3.6}deg`).join(', ');
    const firstStopColor = hexToRgba(gradientStops[0].color, gradientStops[0].opacity);
    css += `
      padding: ${thickness}px;
      background: conic-gradient(from var(--element-vault-angle), ${conicStops}, ${firstStopColor} 360deg);
      animation: element-vault-spin ${speed}s linear infinite;
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
    `;
    } else if (animation.startsWith('level-')) {
    const level = parseInt(animation.split('-')[1]);
    const color1 = hexToRgba(gradientStops[0].color, gradientStops[0].opacity);
    const color2 = gradientStops.length > 1 ? hexToRgba(gradientStops[1].color, gradientStops[1].opacity) : color1;
    
    switch (level) {
      case 1:
        css += `
          background: linear-gradient(270deg, ${color1}, ${color2});
          background-size: 400% 400%;
          animation: element-vault-bg-move ${speed}s ease infinite;
        `;
        break;
      case 2:
        css += `
          background: repeating-linear-gradient(45deg, ${color1}, ${color1} 10px, ${color2} 10px, ${color2} 20px);
          background-size: 200% 200%;
          animation: element-vault-diagonal ${speed}s linear infinite;
        `;
        break;
      case 3:
        css += `
          border: ${thickness}px solid ${color1};
          animation: element-vault-breathe ${speed}s ease-in-out infinite alternate;
        `;
        break;
      case 4:
        css += `
          padding: ${thickness}px;
          background: conic-gradient(from var(--element-vault-angle), ${color1}, ${color2}, ${color1});
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: element-vault-radar ${speed}s linear infinite;
        `;
        break;
      case 5:
        css += `
          border: ${thickness}px dashed ${color1};
          animation: element-vault-breathe ${speed}s linear infinite;
        `;
        break;
      case 6:
        css += `
          border: ${thickness}px solid ${color1};
          --element-vault-pulse-color: ${color1};
          --element-vault-pulse-color-alt: ${color2};
          animation: element-vault-double-pulse ${speed}s ease-out infinite;
        `;
        break;
      case 7:
        css += `
          border: ${thickness}px solid ${color1};
          --element-vault-pulse-color: ${color1};
          animation: element-vault-flicker ${speed}s infinite;
        `;
        break;
      case 8:
        css += `
          border: ${thickness}px solid ${color1};
          animation: element-vault-glitch ${speed}s linear infinite;
        `;
        break;
      case 9:
        css += `
          border: ${thickness}px solid ${color1};
          --element-vault-pulse-color: ${color1};
          animation: element-vault-ripple ${speed}s ease-out infinite;
        `;
        break;
      case 10:
        css += `
          border: ${thickness}px solid ${color1};
          animation: element-vault-chaos ${speed}s infinite;
        `;
        break;
    }
  } else if (animation === 'pulsing') {
    const color1 = hexToRgba(gradientStops[0].color, gradientStops[0].opacity);
    const color2 = gradientStops.length > 1 ? hexToRgba(gradientStops[1].color, gradientStops[1].opacity) : color1;
    css += `
      border: ${thickness}px solid ${color1};
      --element-vault-pulse-color: ${color2};
      animation: element-vault-pulse ${speed}s ease-out infinite;
    `;
  }
  css += `\n}`;
  styleEl.textContent = css;
}

// Read initial style
chrome.storage.sync.get({ activeHighlightStyle: 'rainbow', customStyleConfig: null }, (data) => {
  activeHighlightStyle = data.activeHighlightStyle;
  customStyleConfig = data.customStyleConfig;
  updateCustomStyleRule();
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    overlay.setAttribute('data-style', activeHighlightStyle);
  }
});

// Listen for style changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    if (changes.activeHighlightStyle) {
      activeHighlightStyle = changes.activeHighlightStyle.newValue;
      const overlay = document.getElementById(OVERLAY_ID);
      if (overlay) {
        overlay.setAttribute('data-style', activeHighlightStyle);
      }
    }
    if (changes.customStyleConfig) {
      customStyleConfig = changes.customStyleConfig.newValue;
      updateCustomStyleRule();
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
  if (safeGetAttribute(element, 'id') === OVERLAY_ID || safeGetAttribute(element, 'id') === STYLE_ID || safeGetAttribute(element, 'id') === SHIELD_ID) return true;

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


function safeGetAttribute(el, attr) {
  return Element.prototype.getAttribute.call(el, attr);
}
function safeGetTagName(el) {
  const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'tagName');
  return desc && desc.get ? desc.get.call(el).toLowerCase() : el.tagName.toLowerCase();
}
function safeGetClassList(el) {
  const cls = safeGetAttribute(el, 'class');
  return cls ? cls.trim().split(/\s+/) : [];
}

function getNodePath(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
  const id = safeGetAttribute(element, 'id');
  if (id) return `#${cssEscapeSafe(id)}`;

  const segments = [];
  let cursor = element;
  while (cursor && cursor.nodeType === Node.ELEMENT_NODE) {
    const tag = safeGetTagName(cursor);
    const cursorId = safeGetAttribute(cursor, 'id');

    if (cursorId) {
      segments.unshift(`#${cssEscapeSafe(cursorId)}`);
      break;
    }

    let nth = 1;
    let sibling = cursor;
    while ((sibling = sibling.previousElementSibling)) {
      if (safeGetTagName(sibling) === tag) nth += 1;
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
  const names = Element.prototype.getAttributeNames.call(element);
  for (const name of names) {
    attributes[name] = Element.prototype.getAttribute.call(element, name);
  }
  return attributes;
}

function getFriendlySelector(element) {
  const tag = safeGetTagName(element);
  const rawId = safeGetAttribute(element, 'id');
  const id = rawId ? `#${cssEscapeSafe(rawId)}` : '';
  const clsList = safeGetClassList(element);
  const classes = clsList.length ? `.${clsList.slice(0, 3).join('.')}` : '';
  return `${tag}${id}${classes}`;
}

function snapshotElement(element) {
  const rect = element.getBoundingClientRect();
  const parent = element.parentElement;
  const nextSibling = element.nextElementSibling;

  return {
    id: `removed-${Date.now()}-${++removeCounter}`,
    tagName: safeGetTagName(element),
    selector: getFriendlySelector(element),
    domPath: getNodePath(element),
    parentPath: getNodePath(parent),
    nextSiblingPath: getNodePath(nextSibling),
    classes: safeGetClassList(element),
    textPreview: (element.innerText || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 240),
    attributes: getAttributesMap(element),
    dataset: Object.fromEntries(Element.prototype.getAttributeNames.call(element).filter(n => n.startsWith('data-')).map(n => [n.slice(5), Element.prototype.getAttribute.call(element, n)])),
    inlineStyle: Element.prototype.getAttribute.call(element, 'style') || '',
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
  const node = template.content.firstElementChild;
  if (node) {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
    let current = walker.currentNode;
    while (current) {
      if (safeGetTagName(current) === 'script') {
        const toRemove = current;
        current = walker.nextNode();
        toRemove.remove();
        continue;
      }
      const attrs = Element.prototype.getAttributeNames.call(current);
      for (const attr of attrs) {
        if (attr.toLowerCase().startsWith('on')) {
          Element.prototype.removeAttribute.call(current, attr);
        }
      }
      current = walker.nextNode();
    }
  }
  return node;
}

function removeElement(element) {
  if (isForbiddenTarget(element)) {
    return { ok: false, error: 'That element is protected.' };
  }

  const payload = snapshotElement(element);
  const placeholder = document.createComment(`element-vault:${payload.id}`);

  REMOVED_NODE_MAP.set(payload.id, element);
  PLACEHOLDER_MAP.set(payload.id, placeholder);
  enforceMapSizeLimit();

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
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('pagehide', clearTransientState);
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange, true);
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
  document.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('pagehide', clearTransientState);
  window.removeEventListener('scroll', onViewportChange, true);
  window.removeEventListener('resize', onViewportChange, true);
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

let pointerRafPending = false;
let lastPointerX = 0;
let lastPointerY = 0;

function onShieldPointerMove(event) {
  if (!pickMode) return;
  swallowEvent(event);
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;

  if (!pointerRafPending) {
    pointerRafPending = true;
    requestAnimationFrame(() => {
      pointerRafPending = false;
      updateHoverFromPoint(lastPointerX, lastPointerY);
    });
  }
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
      case 'PING_CONTENT_SCRIPT':
        sendResponse({ ok: true });
        break;

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
