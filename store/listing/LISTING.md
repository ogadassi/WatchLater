# Chrome Web Store listing — Watch Later Manager

Copy each block into the matching field in the developer dashboard
(https://chrome.google.com/webstore/devconsole → the item → Store listing / Privacy).

## Name (in manifest.json)

Current: `YouTube Watch Later Manager`

Suggested: `Watch Later Manager for YouTube`
Starting the name with someone else's brand is a common reason for store rejections and trademark complaints.
"… for YouTube" describes what it works with instead. Changing it means editing `name` in manifest.json and shipping a new version.

## Summary (max 132 characters)

```
Add or remove videos from Watch Later in one click, right on every video card and in the player. No menus.
```

## Description

```
Save videos for later without digging through menus.

Watch Later Manager adds a small clock button next to every video on YouTube. One click and the video is in your Watch Later list. Click again to take it out.

WHAT YOU GET
• One-click save on video cards: home, subscriptions, search results and the suggestions next to a video.
• See what's already saved: videos in your list show a green check. Hover it and it turns into an X that removes the video in one click.
• Save from the player: the same button sits in the player controls, next to captions and settings.
• Fast clean-up: on your Watch Later page, a trash button removes a video instantly.
• Stays out of the way: on channel pages, where YouTube already shows its own Watch Later button, the extension doesn't add a second one.
• Works in light and dark themes, and with YouTube in any language.

PRIVATE BY DESIGN
• No accounts, no tracking, no analytics, no ads.
• Talks only to YouTube, using your existing signed-in session.
• The list of saved video IDs is cached on your own computer so buttons show the right state instantly.

Open source: https://github.com/ogadassi/WatchLater

Watch Later Manager is an independent project and is not affiliated with or endorsed by YouTube or Google.
```

## Category

`Productivity` (or `Entertainment`). Language: English.

## Graphics

| Field | File |
|---|---|
| Store icon (128×128) | `store-icon-128.png` |
| Screenshots (1280×800), in this order | `screenshot-1-one-click.png`, `screenshot-2-saved.png`, `screenshot-3-player.png`, `screenshot-4-cleanup.png` |
| Small promo tile (440×280) | `promo-small-440x280.png` |
| Marquee promo tile (1400×560) | `promo-marquee-1400x560.png` |

## Privacy tab

**Single purpose**
```
Adds one-click buttons on YouTube to add videos to, and remove videos from, the user's Watch Later playlist.
```

**Permission justification — storage**
```
Caches the IDs of videos in the user's Watch Later playlist locally, so each button shows whether a video is already saved without a network request on every page.
```

**Host permission justification — youtube.com (content script)**
```
The extension only runs on youtube.com, where it adds its buttons to video cards and the player and calls YouTube's own playlist endpoint with the user's existing session to add or remove videos.
```

**Remote code**: No, the extension does not use remote code.

**Data usage**: Collects none of the listed data types. Certify: not sold to third parties, not used for unrelated purposes, not used for creditworthiness.

## Links

- Homepage URL: https://github.com/ogadassi/WatchLater
- Support URL: https://github.com/ogadassi/WatchLater/issues
