if (!window.__elementVaultInjected) {
window.__elementVaultInjected = true;

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

let activeHighlightStyle = 'solid-blue';

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
    /* 1. Solid Blue */
    #${OVERLAY_ID}[data-style="solid-blue"] {
      border: 3px solid #0a84ff;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.14), 0 0 12px rgba(10,132,255,0.5);
      background: transparent;
    }

    /* 2. Glowing Green */
    #${OVERLAY_ID}[data-style="glowing-green"] {
      border: 3px solid #32d74b;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.14), 0 0 24px #32d74b, inset 0 0 12px rgba(50,215,75,0.2);
      background: transparent;
    }

    /* 3. Electric Pulse */
    @keyframes element-vault-electric-pulse-glow {
      0%, 100% { filter: drop-shadow(0 0 2px rgba(221, 132, 72, 0.4)) drop-shadow(0 0 5px rgba(221, 132, 72, 0.4)); }
      50% { filter: drop-shadow(0 0 4px rgba(221, 132, 72, 0.6)) drop-shadow(0 0 15px rgba(221, 132, 72, 0.6)); }
    }
    #${OVERLAY_ID}[data-style="electric-pulse"] {
      border: 3px solid #dd8448;
      background: transparent;
      box-shadow: 0 0 15px rgba(221, 132, 72, 0.3), inset 0 0 15px rgba(221, 132, 72, 0.3);
      animation: element-vault-electric-pulse-glow 2s ease-in-out infinite;
    }

    /* 4. Morphing Blob */
    @keyframes element-vault-morphing-blob-anim {
      0% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; box-shadow: 5px 5px 20px rgba(33, 212, 253, 0.4); }
      25% { border-radius: 58% 42% 75% 25% / 76% 46% 54% 24%; }
      50% { border-radius: 50% 50% 33% 67% / 55% 27% 73% 45%; box-shadow: -5px -2px 20px rgba(183, 33, 255, 0.4); }
      75% { border-radius: 33% 67% 58% 42% / 63% 68% 32% 37%; }
      100% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; box-shadow: 5px 5px 20px rgba(33, 212, 253, 0.4); }
    }
    #${OVERLAY_ID}[data-style="morphing-blob"] {
      background: transparent;
      border: none;
    }
    #${OVERLAY_ID}[data-style="morphing-blob"]::before {
      content: "";
      position: absolute;
      inset: -10px;
      padding: 4px;
      background-image: linear-gradient(19deg, #21D4FD 0%, #B721FF 100%);
      animation: element-vault-morphing-blob-anim 5s infinite;
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
    }

    /* 5. Offset Multiply */
    @keyframes element-vault-offset-multiply-border {
      0%, 100% { clip-path: polygon(0 0, calc(100% - 20px) 20px, 100% 100%, 20px calc(100% - 20px)); }
      50% { clip-path: polygon(20px 20px, 100% 0, calc(100% - 20px) calc(100% - 20px), 0 100%); }
    }
    #${OVERLAY_ID}[data-style="offset-multiply"] {
      background: transparent;
      border: 2px solid rgba(255,255,255,0.2);
    }
    #${OVERLAY_ID}[data-style="offset-multiply"]::before,
    #${OVERLAY_ID}[data-style="offset-multiply"]::after {
      content: '';
      position: absolute;
      inset: -15px;
      padding: 3px;
      mix-blend-mode: screen;
      animation: element-vault-offset-multiply-border 5s ease-in-out infinite;
      border-radius: inherit;
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
    }
    #${OVERLAY_ID}[data-style="offset-multiply"]::before {
      background-color: #AA4465;
      clip-path: polygon(20px 20px, 100% 0, calc(100% - 20px) calc(100% - 20px), 0 100%);
    }
    #${OVERLAY_ID}[data-style="offset-multiply"]::after {
      background-color: #93e1d8;
      clip-path: polygon(0 0, calc(100% - 20px) 20px, 100% 100%, 20px calc(100% - 20px));
      animation-delay: -2.5s;
    }

    /* 6. Rainbow Standard */
    @keyframes element-vault-rainbow-move {
      0% { background-position: 0 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0 50%; }
    }
    #${OVERLAY_ID}[data-style="rainbow-standard"] {
      padding: 3px;
      background: linear-gradient(60deg, hsl(224, 85%, 66%), hsl(269, 85%, 66%), hsl(314, 85%, 66%), hsl(359, 85%, 66%), hsl(44, 85%, 66%), hsl(89, 85%, 66%), hsl(134, 85%, 66%), hsl(179, 85%, 66%));
      background-size: 300% 300%;
      animation: element-vault-rainbow-move 4s alternate infinite;
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
    }

    /* 7. Cyber Neon */
    @keyframes element-vault-cyber-pulse {
      0%, 100% { box-shadow: 0 0 10px #f672ca, inset 0 0 5px #f672ca; border-color: rgba(246, 114, 202, 0.8); }
      50% { box-shadow: 0 0 25px #f672ca, inset 0 0 15px #f672ca; border-color: rgba(246, 114, 202, 1); }
    }
    #${OVERLAY_ID}[data-style="cyber-neon"] {
      border: 2px solid #f672ca;
      background: transparent;
      animation: element-vault-cyber-pulse 2s infinite;
    }
    #${OVERLAY_ID}[data-style="cyber-neon"]::before {
      content: "";
      position: absolute;
      inset: 0;
      padding: 10px;
      background: rgba(110, 204, 238, 0.1);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      border-radius: inherit;
      pointer-events: none;
    }

    /* 8. Dot Trace */
    @keyframes element-vault-trace {
      0% { offset-distance: 0%; }
      100% { offset-distance: 100%; }
    }
    #${OVERLAY_ID}[data-style="dot-trace"] {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: transparent;
      border-radius: inherit;
    }
    #${OVERLAY_ID}[data-style="dot-trace"]::after {
      content: '';
      position: absolute;
      width: 15px;
      height: 15px;
      background: #0a84ff;
      border-radius: 50%;
      box-shadow: 0 0 15px 5px #0a84ff, 0 0 30px #0a84ff;
      offset-path: border-box;
      offset-anchor: 50% 50%;
      animation: element-vault-trace 3s infinite linear;
      top: 0;
      left: 0;
    }

    /* 9. Spinning Dash */
    #${OVERLAY_ID}[data-style="spinning-dash"] {
      padding: 3px;
      --element-vault-angle: 0deg;
      animation: element-vault-spin 3s linear infinite;
      background: conic-gradient(from var(--element-vault-angle), #32d74b 0deg, #32d74b 45deg, transparent 45deg, transparent 180deg, #32d74b 180deg, #32d74b 225deg, transparent 225deg);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      filter: drop-shadow(0 0 5px #32d74b);
    }

    /* 10. Neon Pulse */
    @keyframes element-vault-neon-breathe {
      0%, 100% { box-shadow: 0 0 5px #0ea5e9, inset 0 0 5px #0ea5e9; border-color: rgba(14, 165, 233, 0.4); }
      50% { box-shadow: 0 0 20px #0ea5e9, inset 0 0 10px #0ea5e9; border-color: rgba(14, 165, 233, 1); }
    }
    #${OVERLAY_ID}[data-style="neon-pulse"] {
      border: 2px solid rgba(14, 165, 233, 0.6);
      animation: element-vault-neon-breathe 2s ease-in-out infinite;
      background: transparent;
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
chrome.storage.sync.get({ activeHighlightStyle: 'solid-blue', customStyleConfig: null }, (data) => {
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

      
      case 'DUCK_HUNT_TOGGLED':
        if (message.enabled) startDuckHunt();
        else stopDuckHunt();
        sendResponse({ ok: true });
        break;

      case 'DUCK_HUNT_SETTINGS_CHANGED':
        if (message.sound !== undefined) duckHuntSound = message.sound;
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


// --- DUCK HUNT LOGIC ---
let duckHuntEnabled = false;
let duckHuntSound = true;
const trackedAdSlots = new Set();
let duckAudioCtx = null;
let duckSlotDetectorInterval = null;

const CROSSHAIR_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="15" y="0" width="2" height="12" fill="%23FF6B00"/><rect x="15" y="20" width="2" height="12" fill="%23FF6B00"/><rect x="0" y="15" width="12" height="2" fill="%23FF6B00"/><rect x="20" y="15" width="12" height="2" fill="%23FF6B00"/><rect x="14" y="14" width="4" height="4" fill="%23808080"/></svg>`;

function getDuckSvg(color) {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="40" height="40"><path fill="${color}" d="M6 2h4v2h2v2h2v2h-2v4H2v-2H0V8h2V6h2V4h2V2z"/><rect x="12" y="6" width="4" height="2" fill="%23FF6B00"/><rect x="6" y="4" width="2" height="2" fill="%23000"/></svg>`;
}
const DUCK_FLIP_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="40" height="40"><path fill="%23FF0000" d="M6 2h4v2h2v2h2v2h-2v4H2v-2H0V8h2V6h2V4h2V2z"/><rect x="12" y="6" width="4" height="2" fill="%23FF6B00"/><rect x="6" y="4" width="2" height="2" fill="%23000"/></svg>`;

function getDuckType() {
  const r = Math.random();
  if (r > 0.90) return { color: '%23FFD700', points: 1000, speedMultiplier: 2.5, type: 'golden' }; 
  if (r > 0.65) return { color: '%23FF0000', points: 500, speedMultiplier: 1.8, type: 'red' };
  return { color: '%23FFFFFF', points: 100, speedMultiplier: 1.0, type: 'white' };
}

function initDuckAudio() {
  if (!duckAudioCtx) {
    try { duckAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
  }
  if (duckAudioCtx && duckAudioCtx.state === 'suspended') {
    duckAudioCtx.resume();
  }
}

function playGunshot() {
  if (!duckHuntSound || !duckAudioCtx) return;
  const t = duckAudioCtx.currentTime;
  const osc = duckAudioCtx.createOscillator();
  const gain = duckAudioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, t);
  osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.15);
  gain.gain.setValueAtTime(0.8, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
  osc.connect(gain);
  gain.connect(duckAudioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.15);
}

function playHit() {
  if (!duckHuntSound || !duckAudioCtx) return;
  const t = duckAudioCtx.currentTime;
  const osc = duckAudioCtx.createOscillator();
  const gain = duckAudioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(880, t); 
  osc.frequency.setValueAtTime(1318, t + 0.05);
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.15);
  osc.connect(gain);
  gain.connect(duckAudioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.15);
}

function playStartFanfare() {
  if (!duckHuntSound || !duckAudioCtx) return;
  const t = duckAudioCtx.currentTime;
  const osc = duckAudioCtx.createOscillator();
  const gain = duckAudioCtx.createGain();
  osc.type = 'square';
  const notes = [440, 554, 659, 880];
  notes.forEach((freq, i) => {
    osc.frequency.setValueAtTime(freq, t + i * 0.15);
  });
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.setValueAtTime(0.3, t + 0.6);
  gain.gain.linearRampToValueAtTime(0, t + 0.8);
  osc.connect(gain);
  gain.connect(duckAudioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.8);
}

function sendScoreUpdate(action, points = 0) {
  chrome.runtime.sendMessage({ type: 'UPDATE_DUCK_SCORE', action, points }).catch(() => {});
}

function spawnDuckInSlot(slotElement) {
  const rect = slotElement.getBoundingClientRect();
  if (rect.width < 100 || rect.height < 50) return;

  const overlay = document.createElement('div');
  overlay.className = '__duckhunt_overlay__';
  overlay.style.position = 'absolute';
  overlay.style.top = `${slotElement.offsetTop}px`;
  overlay.style.left = `${slotElement.offsetLeft}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.overflow = 'hidden';
  overlay.style.zIndex = '999999';
  overlay.style.pointerEvents = 'auto';

  // Apply Disintegration animation to the ad slot
  slotElement.classList.add('duckhunt-disintegrate-anim');

  // After disintegration, spawn 2-3 ducks
  setTimeout(() => {
    slotElement.style.visibility = 'hidden'; 
    slotElement.parentNode.insertBefore(overlay, slotElement);

    const numDucks = Math.floor(Math.random() * 2) + 2; // 2 or 3
    for(let i=0; i<numDucks; i++) {
      createDuck();
    }
  }, 600);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      sendScoreUpdate('miss');
    }
  });

  function createDuck() {
    if (!duckHuntEnabled || !overlay.parentNode) return;
    const duckData = getDuckType();
    const duck = document.createElement('div');
    duck.style.position = 'absolute';
    duck.style.width = '40px';
    duck.style.height = '40px';
    duck.style.backgroundImage = `url('${getDuckSvg(duckData.color)}')`;
    duck.style.backgroundSize = 'contain';
    duck.style.backgroundRepeat = 'no-repeat';
    duck.style.pointerEvents = 'auto';
    duck.style.cursor = `url('${CROSSHAIR_SVG}') 16 16, crosshair`;
    
    // Random start position
    let x = Math.random() * (rect.width - 40);
    let y = Math.random() * (rect.height - 40);
    let baseSpeed = 1 + Math.random() * 2;
    let vx = (Math.random() > 0.5 ? 1 : -1) * baseSpeed * duckData.speedMultiplier;
    let vy = (Math.random() > 0.5 ? 1 : -1) * baseSpeed * duckData.speedMultiplier;
    
    duck.style.transform = `translate(${x}px, ${y}px) scaleX(${vx > 0 ? 1 : -1})`;
    overlay.appendChild(duck);

    let alive = true;
    let animFrame = null;

    duck.addEventListener('mousedown', (e) => {
      if (!alive) return;
      alive = false;
      e.preventDefault();
      e.stopPropagation();
      initDuckAudio();
      setTimeout(playHit, 10); 
      sendScoreUpdate('kill', duckData.points);
      
      duck.style.backgroundImage = `url('${DUCK_FLIP_SVG}')`;
      duck.style.transform = `translate(${x}px, ${y}px) scaleY(-1)`;
      
      let fallY = y;
      function fall() {
        if (!duck.parentNode) return;
        fallY += 5;
        duck.style.transform = `translate(${x}px, ${fallY}px) scaleY(-1)`;
        if (fallY < rect.height) {
          requestAnimationFrame(fall);
        } else {
          duck.remove();
          if (duckHuntEnabled) setTimeout(createDuck, 3000 + Math.random() * 4000);
        }
      }
      requestAnimationFrame(fall);
    });

    let startTime = performance.now();
    function animate(time) {
      if (!alive || !duckHuntEnabled || !duck.parentNode) return;
      x += vx;
      y += vy;
      
      if (x <= 0 || x >= rect.width - 40) { vx *= -1; }
      if (y <= 0 || y >= rect.height - 40) { vy *= -1; }
      
      duck.style.transform = `translate(${x}px, ${y}px) scaleX(${vx > 0 ? 1 : -1})`;
      
      if (time - startTime > 10000) {
        alive = false;
        sendScoreUpdate('escape');
        duck.style.opacity = '0.5';
        let escapeY = y;
        function escapeAnim() {
          if (!duck.parentNode) return;
          escapeY -= 3;
          duck.style.transform = `translate(${x}px, ${escapeY}px) scaleX(${vx > 0 ? 1 : -1})`;
          if (escapeY > -40) {
            requestAnimationFrame(escapeAnim);
          } else {
            duck.remove();
            if (duckHuntEnabled) setTimeout(createDuck, 3000 + Math.random() * 4000);
          }
        }
        requestAnimationFrame(escapeAnim);
        return;
      }
      animFrame = requestAnimationFrame(animate);
    }
    animFrame = requestAnimationFrame(animate);
  }
}

function detectAdSlots() {
  if (!duckHuntEnabled) return;
  const elements = document.querySelectorAll('iframe, div[class*="ad-"], div[id*="ad-"], .google_ads, .adsbygoogle, [data-ad-client]');
  elements.forEach(el => {
    if (trackedAdSlots.has(el)) return;
    const rect = el.getBoundingClientRect();
    if (rect.width >= 100 && rect.height >= 50 && (el.tagName === 'IFRAME' || !el.innerText.trim() || el.innerHTML.includes('<img'))) {
      trackedAdSlots.add(el);
      spawnDuckInSlot(el);
    }
  });
}

function globalClickListener(e) {
  if (duckHuntEnabled) {
    initDuckAudio();
    playGunshot();
  }
}

function startDuckHunt() {
  if (duckHuntEnabled) return;
  duckHuntEnabled = true;
  document.documentElement.classList.add('duck-hunt-active');
  document.addEventListener('mousedown', globalClickListener, true);

  if (!document.getElementById('__duckhunt_style__')) {
    const style = document.createElement('style');
    style.id = '__duckhunt_style__';
    style.textContent = `
      html.duck-hunt-active, html.duck-hunt-active * { cursor: url('${CROSSHAIR_SVG}') 16 16, crosshair !important; }
      .__duckhunt_overlay__ { pointer-events: auto !important; }
      
      @keyframes duckhunt-flash-text {
        0% { color: #ff0000; text-shadow: 4px 4px 0 #000; }
        25% { color: #00ff00; text-shadow: -4px 4px 0 #000; }
        50% { color: #0000ff; text-shadow: 4px -4px 0 #000; }
        75% { color: #ffff00; text-shadow: -4px -4px 0 #000; }
        100% { color: #ff00ff; text-shadow: 4px 4px 0 #000; }
      }
      @keyframes duckhunt-disintegrate {
        0% { filter: brightness(1) blur(0px); transform: scale(1); opacity: 1; }
        50% { filter: brightness(2) blur(5px); transform: scale(1.1); opacity: 0.8; }
        100% { filter: brightness(3) blur(20px); transform: scale(0); opacity: 0; }
      }
      .duckhunt-disintegrate-anim {
        animation: duckhunt-disintegrate 0.6s forwards ease-in !important;
      }
      .duckhunt-start-banner {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        font-family: Impact, sans-serif;
        font-size: 100px; font-weight: bold; text-transform: uppercase; letter-spacing: 5px;
        z-index: 2147483647; pointer-events: none;
        animation: duckhunt-flash-text 0.1s infinite;
      }
    `;
    document.head.appendChild(style);
  }

  // Play Start Sequence
  initDuckAudio();
  playStartFanfare();
  const banner = document.createElement('div');
  banner.className = 'duckhunt-start-banner';
  banner.textContent = 'AW, DUCK!';
  document.body.appendChild(banner);
  setTimeout(() => {
    banner.remove();
    // Start detecting slots AFTER the sequence
    duckSlotDetectorInterval = setInterval(detectAdSlots, 2000);
    detectAdSlots();
  }, 2000);
}

function stopDuckHunt() {
  duckHuntEnabled = false;
  document.documentElement.classList.remove('duck-hunt-active');
  document.removeEventListener('mousedown', globalClickListener, true);
  clearInterval(duckSlotDetectorInterval);
  trackedAdSlots.clear();
  document.querySelectorAll('.__duckhunt_overlay__').forEach(e => e.remove());
  document.querySelectorAll('.duckhunt-disintegrate-anim').forEach(e => {
    e.classList.remove('duckhunt-disintegrate-anim');
    e.style.visibility = 'visible';
  });
}

chrome.storage.sync.get(['duckHuntEnabled', 'duckHuntSound'], (res) => {
  duckHuntSound = res.duckHuntSound !== false;
  if (res.duckHuntEnabled) startDuckHunt();
});

} // end re-injection guard
