# Project Status & Roadmap

This file contains the structured project status, completed milestones, and future roadmap tasks for the YouTube Watch Later Manager extension. It is designed to be easily parseable by automated project tracking tools and CRMs.

---

## Metadata
```json
{
  "appName": "YouTube Watch Later Manager",
  "shortDescription": "1-click adding/removing of YouTube videos to/from the Watch Later playlist.",
  "repository": "https://github.com/ogadassi/WatchLater",
  "chromeWebStoreId": "cipblemimaiffjenjhnplnegbembhgmc",
  "latestVersion": "1.1",
  "status": "Production-Active",
  "lastUpdated": "2026-07-14"
}
```

---

## Feature Matrix & Completed Missions
- [x] **1-Click Add Button Injections** - Automatically attaches custom action button next to the native 3-dots menus across YouTube homepage feeds, subscription pages, search results, and channel views.
- [x] **1-Click Remove Button Injections** - Attaches trash icon next to video list items in the main Watch Later playlist page (`/playlist?list=WL`) and the side queue panel (`/watch?list=WL`).
- [x] **Modern YouTube DOM Support (v1.1)** - Fully updated selectors to work with YouTube's modern `yt-lockup-view-model` component architecture.
- [x] **Stale DOM Sibling Resolving** - Switched reference query to live click-time resolution instead of caching DOM references at injection time to handle Polymer's DOM reuse and recycling.
- [x] **Lazy-Load Decoupling** - Solved the lazy-loaded 3-dots selector issue by anchoring buttons to static elements (like `.ytLockupMetadataViewModelMenuButton`, `#menu`, etc.) rather than requiring the 3-dots element to exist on page load.
- [x] **Invisible Programmatic Clicks** - Modifies the opacity/visibility of `ytd-popup-container` dynamically during programmatic selection to completely eliminate screen flash and popup flickering.
- [x] **Universal Language Recognition** - Inspects SVG paths (e.g. clock icon SVG data coordinates) instead of raw text strings to locate "Watch Later" / "Save" targets, providing seamless support for Hebrew, English, and other languages.
- [x] **Responsive Styling** - Synchronizes button styling and hover transitions natively with YouTube's native light and dark mode colors.
- [x] **Web Store Assets** - Design and bundle of custom forest-green icons in 16x16, 48x48, and 128x128 sizes.
- [x] **CWS Publication** - Successfully prepared zip packages and submitted version 1.1 to the Chrome Web Store.

---

## Project Backlog & Future Missions
- [ ] **Playlist Choice Selection** - Add popup settings page allowing users to configure which playlist the button targets (e.g., custom playlists instead of only Watch Later).
- [ ] **Mobile Web Support (`m.youtube.com`)** - Adapt DOM parser script and stylesheets to work on mobile browsers.
- [ ] **Configurable Hover Rules** - Introduce options to let users toggle if buttons are always visible or show up on hover only for homepage/feed cards.
- [ ] **MutationObserver Throttling** - Performance enhancement to throttle the DOM listener during high-volume scrolls on massive playlists.
- [ ] **Firefox / Safari Porting** - Package and adapt the extension codebase to cross-browser compatibility standards (Manifest V3 Firefox/Safari variants).
- [ ] **Multi-language Tooltip Translation** - Translate native extension tooltips and title fields to major international locales.
