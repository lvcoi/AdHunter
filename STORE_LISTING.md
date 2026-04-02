# Chrome Web Store Listing

## Title

Ad Hunt — Gamified Ad Blocker

## Short Description

Hunt ads like a retro arcade game! Shoot roaming pixel-art ducks, earn points, and block ads — all from your browser.

## Detailed Description

### Turn Ads Into a Game

Tired of boring ad blockers? Ad Hunt transforms online advertising into a retro arcade experience. When ads are detected on a page, they are replaced with roaming pixel-art ducks that wander across your screen. Click to shoot them and rack up points. Keep an eye out for rare golden ducks — they are worth bonus points and appear when high-value ad placements are removed. The more you browse, the more you hunt.

### DOM Sniper Tool

Take precise control of any web page with the DOM Sniper. Activate sniper mode, hover over any element, and click to remove it instantly. Before you pull the trigger, inspect the element's metadata — tag name, classes, dimensions, and more — so you know exactly what you are targeting. Changed your mind? Every sniped element is saved to the vault, where you can restore it with a single click.

### 10+ Highlight Styles

Make targeted elements impossible to miss. Choose from over ten built-in highlight styles — outlines, overlays, pulsing glows, dashed borders, and more — to visualize elements before removal. Want something unique? Use the custom border builder to define your own color, width, style, and radius for a highlight that fits your workflow.

### Lightweight Ad Blocker

Ad Hunt ships with a curated set of declarative rules that block requests from major ad networks before they ever reach your browser. Because it uses Chrome's declarativeNetRequest API, filtering happens at the network level with zero impact on page performance — no heavy scripts, no slowdowns, just a cleaner web.

### Privacy First

Ad Hunt collects absolutely no user data. There are no analytics, no telemetry, no tracking pixels, and no external servers. Your scores, settings, and sniped-element vault are stored entirely in your browser's local storage. Nothing ever leaves your machine.

---

## Features at a Glance

- Replaces detected ads with roaming pixel-art ducks you can shoot for points
- Golden ducks spawn on high-value ad slots for bonus points
- DOM Sniper mode to pick and remove any element on any page
- Element metadata inspector shows tag, classes, and dimensions before removal
- Sniped-element vault lets you restore anything you removed
- 10+ highlight styles including outlines, overlays, and pulsing glows
- Custom border builder for personalized highlight colors, widths, and radii
- Lightweight declarative ad blocking with zero performance overhead
- Blocks major ad networks at the network level
- Score tracking and session stats in the side panel
- No data collection, no tracking, no external requests
- 100% local — everything stays in your browser

---

## Permissions Explained

Ad Hunt requests only the permissions it needs to function. Here is what each one does and why it is required:

- **storage** — Saves your scores, highlight preferences, vault of sniped elements, and extension settings locally in your browser. Without this permission, your progress and configuration would be lost every time you close the browser.

- **sidePanel** — Opens the Ad Hunt control panel in Chrome's built-in side panel. This is where you view your score, toggle features, pick highlight styles, and manage your sniped-element vault without leaving the current page.

- **tabs** — Allows the extension to detect when you navigate to a new page so it can inject the duck-hunting game and DOM Sniper tool into the active tab. This permission is also used to coordinate communication between the side panel and the content script running on the page.

- **declarativeNetRequest** — Powers the lightweight ad blocker. This permission lets Ad Hunt register network-level rules that block requests to known ad domains before they load, using Chrome's efficient built-in filtering engine rather than heavy content scripts.

- **scripting** — Enables the extension to inject the content script that replaces ads with ducks, powers the DOM Sniper crosshair, and applies highlight styles. This is the core mechanism that makes the on-page game and element-removal tools work.

- **host_permissions (`<all_urls>`)** — Required so the content script and ad-blocking rules can operate on every website you visit. Without broad host access, Ad Hunt could only work on a limited set of pre-approved sites, defeating the purpose of a general-purpose ad blocker and game.
