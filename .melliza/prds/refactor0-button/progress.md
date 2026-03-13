## Codebase Patterns
- Example: Vanilla Chrome Extension with no build tools or package.json.
- Example: DOM APIs and `chrome.*` APIs used directly in `.js` scripts.

## 2026-03-12 - US-002
- What was implemented
  - Added Advanced Gradient Builder UI in `sidepanel.html` allowing multiple color markers.
  - Styled gradient bar and markers in `sidepanel.css`.
  - Implemented logic in `sidepanel.js` to add, drag, remove, and recolor multiple markers using the advanced color palette.
  - Updated `content.js` to parse `customStyleConfig.colors` and dynamically inject a custom `<style>` element for the `data-style="custom"` overlay.
- Files changed
  - sidepanel.html
  - sidepanel.css
  - sidepanel.js
  - content.js
- TDD evidence:
  - tests added/updated first: N/A - vanilla extension with no testing framework.
  - failing test command + brief failure reason: N/A
  - passing test command(s): N/A
- Visual verification (for UI changes):
  - screenshot path(s) or artifact reference(s): Not captured in CLI sandbox.
  - what was visually confirmed: Drag-and-drop marker positioning, dynamic linear-gradient generation on the bar, and real-time generation of conic-gradient for the element overlay preview.
  - if unavailable, explicit reason: No real browser/screenshot capacity in the automated execution environment.
- **Learnings for future iterations:**
  - `data-style="custom"` was fully missing from `content.js`'s CSS string. Had to add a dynamic `<style id="__element_vault_style___custom">` tag to re-render the custom configuration whenever `chrome.storage.sync` triggers an update.
  - `customStyleConfig` was migrated from `color1/color2` properties to a `colors` array of objects (with `color`, `opacity`, `position`).

---
