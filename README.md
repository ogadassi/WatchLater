# YouTube Watch Later Manager

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/cipblemimaiffjenjhnplnegbembhgmc?style=for-the-badge&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/youtube-watch-later-manag/cipblemimaiffjenjhnplnegbembhgmc)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)

A lightweight, high-performance Chrome extension that streamlines your YouTube experience by adding one-click buttons to instantly add and remove videos from your **Watch Later** playlist. No slow menus, no unnecessary clicks.

---

### 📊 Project Status & Jira Roadmap
Track active tasks, completed features, and future plans in the structured status dashboard: **[PROJECT_STATUS.md](PROJECT_STATUS.md)**

---

## Features

- **⚡ 1-Click Adding**: Adds a clean "Add to Watch Later" button directly next to the 3-dots menu on video cards. Works on the homepage, subscription feeds, and search pages.
- **🗑️ 1-Click Removing**: Adds a dedicated trash can button right next to playlist items on the Watch Later page, enabling fast, painless playlist cleanups.
- **👁️ Native Hover Behavior**: On compact sidebar/suggested video lists, the add button remains hidden and seamlessly fades in on hover alongside YouTube's native controls.
- **🌐 Language Independent**: Uses SVG path matching rather than English text strings to guarantee full compatibility with localized YouTube interfaces (e.g. English, Hebrew, etc.).
- **🌗 Theme-Aware Styling**: Perfectly adapts to YouTube's Dark and Light themes out-of-the-box.
- **🔒 Privacy First**: Zero third-party tracker connections. Runs entirely on your local machine.

---

## Installation

### From Chrome Web Store (Recommended)
Install the extension directly with automatic updates:
👉 **[Get YouTube Watch Later Manager on Chrome Web Store](https://chromewebstore.google.com/detail/youtube-watch-later-manag/cipblemimaiffjenjhnplnegbembhgmc)**

### Installing Locally (Development)
If you want to run the developer build or contribute:
1. Clone this repository:
   ```bash
   git clone https://github.com/ogadassi/WatchLater.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the `WatchLater` project folder.

---

## How It Works

YouTube lazy-loads its interactive elements and recycles DOM elements as you scroll. This extension handles these performance optimizations elegantly:
1. **Dynamic Injection**: Uses a `MutationObserver` to watch for new video items loaded via infinite scrolling and automatically injects custom controls.
2. **Context-Aware Triggering**: Rather than maintaining fragile, stale references to recycled DOM nodes, the extension locates and clicks the corresponding underlying YouTube menu options in real-time behind the scenes.
3. **Menu Hiding**: Temporarily hides the popup container opacity during programmatic clicks so the menu never flashes on the user's screen.

---

## File Structure

```text
├── manifest.json   # Chrome Extension configuration
├── content.js      # Core logic for DOM injection and click simulation
├── styles.css      # Custom styles matching YouTube's design system
├── icon16.png      # Extension icon (16x16)
├── icon48.png      # Extension icon (48x48)
└── icon128.png     # Extension icon (128x128)
```

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
