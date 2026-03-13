const fs = require('fs');
let code = fs.readFileSync('sidepanel.js', 'utf8');

const oldBlockStart = "const customThickness = document.getElementById('customThickness');";
const idx = code.indexOf(oldBlockStart);
if (idx === -1) {
  console.log("Could not find start");
  process.exit(1);
}

const topHalf = code.substring(0, idx);

const bottomHalf = `const customThickness = document.getElementById('customThickness');
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

function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return \`rgba(\${r}, \${g}, \${b}, \${opacity})\`;
}

function renderGradientBar() {
  if (!gradientBar || !gradientMarkers) return;

  gradientStops.sort((a, b) => a.position - b.position);

  const linearStops = gradientStops.map(stop => \`\${hexToRgba(stop.color, stop.opacity)} \${stop.position}%\`).join(', ');
  gradientBar.style.background = \`linear-gradient(90deg, \${linearStops})\`;

  gradientMarkers.innerHTML = '';
  gradientStops.forEach((stop, index) => {
    const marker = document.createElement('div');
    marker.className = \`gradient-marker\${index === activeMarkerIndex ? ' active' : ''}\`;
    marker.style.left = \`\${stop.position}%\`;
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
    const conicStops = gradientStops.map(stop => \`\${hexToRgba(stop.color, stop.opacity)} \${stop.position * 3.6}deg\`).join(', ');
    const firstStopColor = hexToRgba(gradientStops[0].color, gradientStops[0].opacity);
    customPreview.style.padding = \`\${thickness}px\`;
    customPreview.style.background = \`conic-gradient(from var(--preview-angle), \${conicStops}, \${firstStopColor} 360deg)\`;
    customPreview.style.animation = \`preview-spin \${speed}s linear infinite\`;
    customPreview.style.webkitMask = 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)';
    customPreview.style.webkitMaskComposite = 'xor';
    customPreview.style.maskComposite = 'exclude';
  } else if (animation === 'marching-ants') {
    customPreview.style.background = 'transparent';
    const c1 = gradientStops[0].color;
    customPreview.style.backgroundImage = \`
      linear-gradient(90deg, \${c1} 50%, transparent 50%),
      linear-gradient(90deg, \${c1} 50%, transparent 50%),
      linear-gradient(0deg, \${c1} 50%, transparent 50%),
      linear-gradient(0deg, \${c1} 50%, transparent 50%)
    \`;
    customPreview.style.backgroundRepeat = 'repeat-x, repeat-x, repeat-y, repeat-y';
    customPreview.style.backgroundSize = \`20px \${thickness}px, 20px \${thickness}px, \${thickness}px 20px, \${thickness}px 20px\`;
    customPreview.style.backgroundPosition = \`0 0, 0 100%, 0 0, 100% 0\`;
    customPreview.style.animation = \`preview-marching \${speed}s linear infinite\`;
    customPreview.style.opacity = gradientStops[0].opacity;
  } else if (animation === 'pulsing') {
    const color1 = hexToRgba(gradientStops[0].color, gradientStops[0].opacity);
    const color2 = gradientStops.length > 1 ? hexToRgba(gradientStops[1].color, gradientStops[1].opacity) : color1;
    customPreview.style.border = \`\${thickness}px solid \${color1}\`;
    customPreview.style.setProperty('--pulse-color', color2);
    customPreview.style.animation = \`preview-pulse \${speed}s ease-out infinite\`;
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

function openColorPicker(index) {
  activeMarkerIndex = index;
  const stop = gradientStops[index];
  if (!stop) return;
  
  const {r, g, b} = hexToRgbVals(stop.color);
  const a = parseFloat(stop.opacity || '1');
  
  cpR.value = cpRNum.value = r;
  cpG.value = cpGNum.value = g;
  cpB.value = cpBNum.value = b;
  cpA.value = cpANum.value = a;
  cpHexInput.value = stop.color;
  
  updateColorPickerUI(false);
  if (advancedColorPicker) advancedColorPicker.style.display = 'flex';
}

function closeColorPicker() {
  if (advancedColorPicker) advancedColorPicker.style.display = 'none';
  activeMarkerIndex = -1;
  renderGradientBar();
}

function updateColorPickerUI(propagate = true) {
  let r = parseInt(cpR.value) || 0;
  let g = parseInt(cpG.value) || 0;
  let b = parseInt(cpB.value) || 0;
  let a = parseFloat(cpA.value);
  if (isNaN(a)) a = 1;
  
  const hex = rgbToHexStr(r, g, b);
  cpHexInput.value = hex;
  cpCurrentColor.style.backgroundColor = \`rgba(\${r}, \${g}, \${b}, \${a})\`;
  
  if (propagate && activeMarkerIndex !== -1 && gradientStops[activeMarkerIndex]) {
    gradientStops[activeMarkerIndex].color = hex;
    gradientStops[activeMarkerIndex].opacity = a;
    renderGradientBar();
    updateCustomPreview();
  }
}

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
`;

fs.writeFileSync('sidepanel.js', topHalf + bottomHalf);
console.log('Done rewriting sidepanel.js');
