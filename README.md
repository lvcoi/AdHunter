<div align="center">
  <h1>🦆 AdHunter</h1>
  <p><strong>A Manifest V3 Chrome Extension that turns ad blocking into an 80s retro arcade game!</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Manifest-V3-32d74b?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/Vanilla-JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="Vanilla JS" />
    <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension" />
  </p>
</div>

---

AdHunter isn't just another ad blocker. Instead of quietly hiding ads, it replaces them with **animated, retro pixel-art rubber ducks** that you can shoot for high scores in our **Duck Ads!** mini-game. 

When you aren't hunting ducks, AdHunter acts as a powerful DOM sniper, allowing you to pick, inspect, and vault any element on a webpage.

## ✨ Features

### 🦆 Duck Ads! Game Mode
- **Gamified Ad Blocking**: Detected ad slots are replaced by roaming rubber ducks.
- **Retro Arcade Feel**: Features an authentic crosshair, custom gunshot sound effects, and high score tracking.
- **Golden Ducks**: Watch out for the elusive high-speed, high-point golden ducks!
- **Persistent High Scores**: Compete against yourself with sidepanel scoreboard tracking.

### 🎯 Advanced DOM Sniper
- **Precision Element Picking**: Enter pick mode to target and remove any element from the page.
- **Custom Highlight Styles**: Choose from 10+ animated crosshair highlight styles including *Cyber Neon*, *Electric Pulse*, *Morphing Blob*, and *Rainbow Standard*.
- **Vault & Inspect**: Captured elements are stored in the Element Vault inside the Chrome Sidepanel.
- **Deep Inspection**: View the exact DOM path, outer HTML, computed styles, and attributes of the vaulted elements.
- **One-Click Restore**: Put any vaulted element exactly back where it was.

### 🛡️ Core Ad Blocker
- **Minimalist Ruleset**: Efficient static network block rules for known ad domains (`doubleclick.net`, `googlesyndication.com`, etc.).
- **Seamless Toggle**: Enable or disable the core ad blocker directly from the side panel.

---

## 🚀 Installation (Developer Mode)

To install AdHunter locally on your Chrome browser:

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Toggle on **Developer mode** in the top right corner.
4. Click **Load unpacked** in the top left corner.
5. Select the `dist/` folder (or the `AdHunter` root folder).
6. **Pin** the extension to your toolbar for quick access!

## 🎮 How to Play / Use

### Playing Duck Ads!
1. Navigate to any website with ads (or a test page).
2. Open the AdHunter sidepanel by clicking the extension icon.
3. Click the **Start Duck Ads!** button.
4. Watch ads turn into ducks, aim your crosshair, and click to shoot!
5. Check your score and high score in the sidepanel. Turn on sound for the best experience.

### Using the DOM Sniper
1. Open the AdHunter sidepanel on any webpage.
2. Click **Pick and remove**.
3. Move your mouse around the page to see the custom highlight style track elements.
4. **Click** an element to vault it.
5. Inspect the metadata in the sidepanel or click **Restore** to bring it back.
6. Customize your crosshair style from the settings dropdown in the sidepanel.

## 🛠️ Architecture & Tech Stack
- **Manifest V3**: Fully compliant with modern Chrome extension security and architecture guidelines.
- **Vanilla JavaScript**: Zero dependencies. Lightweight and blazing fast.
- **Chrome APIs**: Deeply integrates with `chrome.sidePanel`, `chrome.storage`, and `chrome.declarativeNetRequest`.
- **Pure CSS Animations**: High-performance, GPU-accelerated highlight overlays.

---

<div align="center">
  <p><i>Happy Hunting!</i></p>
</div>
