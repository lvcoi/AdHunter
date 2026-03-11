# Element Vault [WIP]

A Chrome Manifest V3 extension that:

- lets you pick an element directly from the page
- removes it from the DOM
- stores a snapshot in a Chrome side panel
- shows DOM path, attributes, dataset, inline style, computed style, and outer HTML
- restores the element later
- highlights hovered targets during pick mode with an animated multicolor border
- includes a simple ad blocker with an on/off switch in the side panel

## Files

- `manifest.json` — MV3 manifest
- `background.js` — side panel setup + storage broker + ad blocker ruleset toggle
- `content.js` — page picking, highlight overlay, remove/restore logic
- `sidepanel.html` / `sidepanel.css` / `sidepanel.js` — side panel UI
- `rules/adblock-rules.json` — static network block rules for ad domains

## Load it in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder
5. Pin the extension if you want quick access
6. Click the extension icon to open the side panel

## How to use it

1. Open any normal webpage
2. Open the extension side panel
3. Click **Pick and remove**
4. Hover page elements to see the animated border
5. Click an element to remove it
6. Inspect the captured metadata in the side panel
7. Click **Restore** to put it back
8. Use the **Simple ad blocker** switch to enable or disable blocking for:
   - `doubleclick.net`
   - `googlesyndication.com`
   - `googleadservices.com`

## Notes

- Restore is strongest before the page reloads or re-renders heavily.
- After a reload, the extension falls back to restoring from the captured HTML and DOM path.
- The **Forget records** button only clears side-panel records for the current tab. It does not put elements back.
- The ad blocker is intentionally minimal and only blocks the three domains listed above.
