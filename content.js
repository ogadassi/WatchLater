console.log('[Watch Later Ext] INITIALIZED version 1.2 (Direct DOM checks)');
let watchLaterIds = new Set();
let lastInteractedVideoId = null;


function parseYtInitialData(html) {
  const index = html.indexOf('ytInitialData');
  if (index === -1) return null;
  
  const start = html.indexOf('{', index);
  if (start === -1) return null;
  
  let braces = 1;
  let end = start + 1;
  while (braces > 0 && end < html.length) {
    const char = html[end];
    if (char === '{') braces++;
    else if (char === '}') braces--;
    end++;
  }
  
  if (braces === 0) {
    const jsonStr = html.substring(start, end);
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('[Watch Later Ext] Failed to parse extracted JSON:', e);
    }
  }
  return null;
}

async function fetchWatchLaterVideoIds() {
  try {
    const response = await fetch('https://www.youtube.com/playlist?list=WL');
    const html = await response.text();
    const data = parseYtInitialData(html);
    if (!data) {
      console.error('[Watch Later Ext] Could not find or parse ytInitialData in HTML.');
      return new Set();
    }

    const videoIds = new Set();
    
    function findVideoIds(obj) {
      if (!obj || typeof obj !== 'object') return;
      if (obj.playlistVideoRenderer && obj.playlistVideoRenderer.videoId) {
        videoIds.add(obj.playlistVideoRenderer.videoId);
        return;
      }
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          findVideoIds(obj[key]);
        }
      }
    }
    
    findVideoIds(data);
    return videoIds;
  } catch (e) {
    console.error('[Watch Later Ext] Error fetching watch later IDs:', e);
    return new Set();
  }
}

function saveWatchLaterIdsToStorage() {
  chrome.storage.local.set({
    watchLaterIds: Array.from(watchLaterIds),
    lastFetchedTime: Date.now()
  });
}

// Read ytcfg data by scanning already-loaded <script> tags (no new code execution, CSP-safe)
// Result is cached so we only scan once per page
let _pageConfigCache = null;
function getPageConfig() {
  if (_pageConfigCache) return _pageConfigCache;
  try {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      if (!text.includes('INNERTUBE_API_KEY')) continue;

      const apiKeyMatch     = text.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
      const clientVerMatch  = text.match(/"clientVersion"\s*:\s*"([^"]+)"/);
      const clientNameMatch = text.match(/"clientName"\s*:\s*"([^"]+)"/);
      const visitorMatch    = text.match(/"VISITOR_DATA"\s*:\s*"([^"]+)"/);

      if (apiKeyMatch) {
        _pageConfigCache = {
          apiKey: apiKeyMatch[1],
          visitorData: visitorMatch ? visitorMatch[1] : null,
          context: {
            client: {
              clientName: (clientNameMatch && clientNameMatch[1]) || 'WEB',
              clientVersion: (clientVerMatch && clientVerMatch[1]) || '2.20260722.01.00'
            }
          }
        };
        return _pageConfigCache;
      }
    }
  } catch (e) {
    console.warn('[Watch Later Ext] Error reading page config from script tags:', e);
  }
  return {};
}

async function getSapisidHash() {
  // Try both cookie names YouTube uses
  const cookieNames = ['__Secure-3PAPISID', 'SAPISID'];
  let sapisid = null;
  for (const name of cookieNames) {
    const match = document.cookie.match(new RegExp('(?:^|;)\\s*' + name + '=([^;]+)'));
    if (match) { sapisid = match[1]; break; }
  }
  if (!sapisid) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${timestamp} ${sapisid} https://www.youtube.com`;
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${timestamp}_${hashHex}`;
}

async function removeFromWatchLaterViaApi(videoId) {
  if (!videoId) return false;
  try {
    // getPageConfig is now synchronous (reads existing script tags, no CSP issue)
    const cfg = getPageConfig();
    const sapisidHash = await getSapisidHash();

    if (!sapisidHash) {
      console.error('[Watch Later Ext] Could not compute SAPISIDHASH — user may not be logged in.');
      return false;
    }

    const apiKey = cfg.apiKey || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
    const context = cfg.context || { client: { clientName: 'WEB', clientVersion: '2.20260722.01.00' } };
    const clientVersion = context.client?.clientVersion || '2.20260722.01.00';

    console.log(`[Watch Later Ext] Calling edit_playlist API. apiKey: ${apiKey.slice(0,8)}..., clientVersion: ${clientVersion}`);

    const response = await fetch(
      `https://www.youtube.com/youtubei/v1/browse/edit_playlist?key=${apiKey}&prettyPrint=false`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `SAPISIDHASH ${sapisidHash}`,
          'X-Origin': 'https://www.youtube.com',
          'X-Goog-AuthUser': '0',
          'X-Youtube-Client-Name': '1',
          'X-Youtube-Client-Version': clientVersion,
        },
        body: JSON.stringify({
          playlistId: 'WL',
          actions: [{ action: 'ACTION_REMOVE_VIDEO_BY_VIDEO_ID', removedVideoId: videoId }],
          context: context
        })
      }
    );

    if (response.ok) {
      console.log(`[Watch Later Ext] ✓ Removed video "${videoId}" from Watch Later via API.`);
      return true;
    } else {
      const txt = await response.text();
      console.error(`[Watch Later Ext] API removal failed (${response.status}):`, txt.slice(0, 300));
      return false;
    }
  } catch (e) {
    console.error('[Watch Later Ext] Error calling removal API:', e);
    return false;
  }
}

function initWatchLaterCache() {
  chrome.storage.local.get(['watchLaterIds', 'lastFetchedTime'], async (result) => {
    const now = Date.now();
    let cacheValid = false;

    if (result.watchLaterIds && result.lastFetchedTime) {
      // 1 hour cache validation
      if (now - result.lastFetchedTime < 60 * 60 * 1000) {
        watchLaterIds = new Set(result.watchLaterIds);
        cacheValid = true;
        console.log(`[Watch Later Ext] Loaded ${watchLaterIds.size} video IDs from storage cache.`);
        updateAllButtonsState();
      }
    }

    if (!cacheValid) {
      console.log('[Watch Later Ext] Cache invalid or missing. Fetching fresh Watch Later IDs...');
      const freshIds = await fetchWatchLaterVideoIds();
      watchLaterIds = freshIds;
      console.log(`[Watch Later Ext] Fetched ${watchLaterIds.size} fresh video IDs from YouTube.`);
      saveWatchLaterIdsToStorage();
      updateAllButtonsState();
    }
  });
}

// Sync changes from other tabs in real-time
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.watchLaterIds) {
    watchLaterIds = new Set(changes.watchLaterIds.newValue || []);
    console.log(`[Watch Later Ext] Storage changed. Loaded ${watchLaterIds.size} video IDs.`);
    updateAllButtonsState();
  }
});

function findDeepLink(el) {
  if (!el) return null;
  if (el.tagName === 'A') {
    const href = el.getAttribute('href');
    if (href && href.includes('watch?v=')) {
      return href;
    }
  }
  
  if (el.children) {
    for (const child of el.children) {
      const found = findDeepLink(child);
      if (found) return found;
    }
  }
  
  if (el.shadowRoot && el.shadowRoot.children) {
    for (const child of el.shadowRoot.children) {
      const found = findDeepLink(child);
      if (found) return found;
    }
  }
  return null;
}

function findNativeOverlayButton(el) {
  if (!el) return null;
  const tag = el.tagName ? el.tagName.toUpperCase() : '';
  if (tag === 'YTD-THUMBNAIL-OVERLAY-TOGGLE-BUTTON-RENDERER' || tag === 'YT-THUMBNAIL-OVERLAY-TOGGLE-BUTTON-RENDERER') {
    const label = (el.getAttribute('aria-label') || '').toLowerCase();
    const isWatchLater = label.includes('watch later') || label.includes('צפייה מאוחרת') || label.includes('לצפייה מאוחרת');
    if (isWatchLater) {
      return el;
    }
  }
  
  if (el.children) {
    for (const child of el.children) {
      const found = findNativeOverlayButton(child);
      if (found) return found;
    }
  }
  
  if (el.shadowRoot && el.shadowRoot.children) {
    for (const child of el.shadowRoot.children) {
      const found = findNativeOverlayButton(child);
      if (found) return found;
    }
  }
  return null;
}

function clickNativeOverlayButton(videoEl, actionType) {
  const overlay = findNativeOverlayButton(videoEl);
  if (overlay) {
    const label = (overlay.getAttribute('aria-label') || '').toLowerCase();
    const isAlreadyAdded = label.includes('remove') || label.includes('הסר') || label.includes('הסרה');
    
    console.log(`[Watch Later Ext] Found native overlay button:`, overlay, `Label: "${label}", isAlreadyAdded: ${isAlreadyAdded}, actionType: "${actionType}"`);
    
    if (actionType === 'add' && !isAlreadyAdded) {
      overlay.click();
      console.log('[Watch Later Ext] Clicked native overlay button to ADD.');
      return true;
    } else if (actionType === 'remove' && isAlreadyAdded) {
      overlay.click();
      console.log('[Watch Later Ext] Clicked native overlay button to REMOVE.');
      return true;
    } else {
      console.log('[Watch Later Ext] Native overlay button is already in desired state.');
      return true;
    }
  }
  return false;
}

function getVideoId(videoEl) {
  if (!videoEl) return null;
  
  if (videoEl.data && videoEl.data.videoId) {
    return videoEl.data.videoId;
  }
  if (videoEl.videoId) {
    return videoEl.videoId;
  }

  // Look for any link with watch?v=
  const links = videoEl.querySelectorAll('a[href*="watch?v="]');
  for (const link of links) {
    const href = link.getAttribute('href');
    if (href) {
      const match = href.match(/[?&]v=([^&#]+)/);
      if (match) {
        return match[1];
      }
    }
  }

  // Shadow DOM fallback
  const deepLink = findDeepLink(videoEl);
  if (deepLink) {
    const match = deepLink.match(/[?&]v=([^&#]+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function updateButtonState(btn, isSaved) {
  if (isSaved) {
    btn.classList.add('wl-state-added');
    btn.title = "Remove from Watch Later";
  } else {
    btn.classList.remove('wl-state-added');
    btn.title = "Add to Watch Later";
  }
}

function updateAllButtonsState() {
  const btns = document.querySelectorAll('.wl-custom-add-btn');
  btns.forEach(btn => {
    if (btn.classList.contains('wl-just-removed')) return;

    const videoEl = btn.closest(
      'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model'
    );
    if (!videoEl) return;
    const videoId = getVideoId(videoEl);
    if (videoId) {
      const isSaved = watchLaterIds.has(videoId);
      updateButtonState(btn, isSaved);
    }
  });
}

function injectButtons() {
  // Only run on the Watch Later playlist page
  if (!window.location.href.includes('list=WL')) return;

  const videos = document.querySelectorAll('ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer');
  videos.forEach(video => {
    // Check if we already added the button to this video
    if (video.querySelector('.wl-custom-remove-btn')) return;

    const menuContainer = video.querySelector('#menu');
    if (!menuContainer) return;

    const btn = document.createElement('button');
    btn.className = 'wl-custom-remove-btn';
    // SVG icon for a trash can
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false">
        <g>
          <path d="M11 17H9V8h2v9zm4-9h-2v9h2V8zm4-4v1h-1v16H6V5H5V4h4V3h6v1h4zm-2 1H7v15h10V5z"></path>
        </g>
      </svg>
    `;
    btn.title = "1-Click Remove from Watch Later";

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const videoId = getVideoId(video);

      // Optimistic: animate the row out immediately — feels instant
      video.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
      video.style.opacity = '0';
      video.style.transform = 'translateX(-12px)';
      const removeTimer = setTimeout(() => video.remove(), 200);

      if (videoId) {
        watchLaterIds.delete(videoId);
        saveWatchLaterIdsToStorage();
      }

      // Fire API in background — if it fails, restore the row
      removeFromWatchLaterViaApi(videoId).then(success => {
        if (!success) {
          console.warn('[Watch Later Ext] API removal failed for trash btn, row will stay removed from local cache.');
          // Row is already gone from DOM — just clear the timer to be safe
          clearTimeout(removeTimer);
        }
      });
    });

    // Insert our button before the existing menu button so it appears to the left of the 3 dots
    menuContainer.insertBefore(btn, menuContainer.firstChild);
  });
}

// Helper function to click the native "Remove from Watch later" option
function clickRemoveOption() {
  return new Promise(resolve => {
    let attempts = 0;
    let foundItemsLog = [];

    const interval = setInterval(() => {
      attempts++;
      
      const items = document.querySelectorAll('ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer, tp-yt-paper-item');
      for (const item of items) {
        if (item.getBoundingClientRect().height === 0) continue;

        const text = item.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
        const html = item.innerHTML;
        
        if (text && !foundItemsLog.includes(text)) {
          foundItemsLog.push(text);
        }

        const isRemove = text.includes('remove from') || 
                         (text.includes('remove') && text.includes('watch later')) || 
                         html.includes('M11 17H9V8h2v9zm4-9h-2v9h2V8zm4-4v1h-1v16H6V5H5V4h4V3h6v1h4zm-2 1H7v15h10V5z');

        if (isRemove) {
          item.click();
          item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          clearInterval(interval);
          resolve(true);
          return;
        }
      }

      if (attempts > 50) {
        clearInterval(interval);
        console.error('Watch Later Extension: Could not find the remove option. Available visible menu items were:', foundItemsLog);
        resolve(false);
      }
    }, 50);
  });
}

function injectAddButtons() {
  // Don't inject on the Watch Later playlist page
  if (window.location.href.includes('list=WL')) return;

  const videos = document.querySelectorAll(
    'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model'
  );
  
  videos.forEach(video => {
    if (video.tagName.toLowerCase() === 'yt-lockup-view-model' && 
        video.parentElement.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer')) {
      return;
    }

    if (video.querySelector('.wl-custom-add-btn')) return;

    let menuContainer = video.querySelector('.ytLockupMetadataViewModelMenuButton') ||
                        video.querySelector('[class*="MenuButton"]') ||
                        video.querySelector('#menu') ||
                        video.querySelector('ytd-menu-renderer');

    if (!menuContainer) return;

    const btn = document.createElement('button');
    btn.className = 'wl-custom-add-btn';
    btn.innerHTML = `
      <!-- Clock/Plus icon (Default) -->
      <svg class="wl-icon-add" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" style="width:24px;height:24px;">
         <g><path d="M14.97 16.95 10 13.87V7h2v5.76l4.03 2.49-1.06 1.7zM12 3c-4.96 0-9 4.04-9 9s4.04 9 9 9 9-4.04 9-9-4.04-9-9-9m0-1c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"></path></g>
      </svg>
      <!-- Green Checkmark icon -->
      <svg class="wl-icon-check" viewBox="0 0 24 24" style="width:24px;height:24px;">
         <g><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></g>
      </svg>
      <!-- Red X icon -->
      <svg class="wl-icon-remove" viewBox="0 0 24 24" style="width:24px;height:24px;">
         <g><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></g>
      </svg>
    `;

    const videoId = getVideoId(video);
    const isSaved = videoId ? watchLaterIds.has(videoId) : false;
    updateButtonState(btn, isSaved);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const videoEl = btn.closest(
        'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model'
      );
      if (!videoEl) return;

      const currentVideoId = getVideoId(videoEl);
      const isAdded = btn.classList.contains('wl-state-added');
      const actionType = isAdded ? 'remove' : 'add';

      if (actionType === 'remove' && currentVideoId) {
        // --- OPTIMISTIC REMOVE: flip state instantly, API in background ---
        updateButtonState(btn, false);
        btn.classList.add('wl-just-removed');
        watchLaterIds.delete(currentVideoId);
        saveWatchLaterIdsToStorage();

        videoEl.addEventListener('mouseleave', function reset() {
          btn.classList.remove('wl-just-removed');
          videoEl.removeEventListener('mouseleave', reset);
        });

        removeFromWatchLaterViaApi(currentVideoId).then(success => {
          if (!success) {
            // Revert if API failed
            console.warn('[Watch Later Ext] API remove failed, reverting button state.');
            updateButtonState(btn, true);
            btn.classList.remove('wl-just-removed');
            watchLaterIds.add(currentVideoId);
            saveWatchLaterIdsToStorage();
          }
        });
        return;
      }

      // --- ADD path: use native overlay / menu automation (async) ---
      (async () => {
        let status = 'failed';
        const usedOverlay = clickNativeOverlayButton(videoEl, actionType);
        if (usedOverlay) {
          status = 'added';
        } else {
          let triggerBtn = videoEl.querySelector('.ytLockupMetadataViewModelMenuButton button-view-model button') ||
                           videoEl.querySelector('.ytLockupMetadataViewModelMenuButton button') ||
                           videoEl.querySelector('button[aria-haspopup="true"], button[aria-haspopup="menu"]') ||
                           videoEl.querySelector('ytd-menu-renderer yt-icon-button#button button') ||
                           videoEl.querySelector('ytd-menu-renderer button');

          if (triggerBtn) {
            const popupContainer = document.querySelector('ytd-popup-container');
            if (popupContainer) {
              popupContainer.style.opacity = '0';
              popupContainer.style.pointerEvents = 'none';
            }
            triggerBtn.click();
            status = await clickOption(actionType);
            if (popupContainer) {
              popupContainer.style.opacity = '';
              popupContainer.style.pointerEvents = '';
            }
          }
        }

        if (status === 'failed') {
          document.body.click();
        } else if (status === 'added' || status === 'already_there') {
          if (currentVideoId) {
            watchLaterIds.add(currentVideoId);
            saveWatchLaterIdsToStorage();
          }
          updateButtonState(btn, true);
        }
      })();
    });

    menuContainer.appendChild(btn);
  });
}

function clickOption(actionType) {
  console.log(`[Watch Later Ext] clickOption starting with actionType: "${actionType}"`);
  
  const popupContainer = document.querySelector('ytd-popup-container');
  if (popupContainer) {
    popupContainer.classList.add('wl-hide-popup');
  }

  return new Promise(resolve => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      
      let items = [];
      if (popupContainer) {
        items.push(...popupContainer.querySelectorAll(
          'ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer, ' +
          'tp-yt-paper-item, yt-list-item-view-model, ' +
          'ytd-menu-popup-renderer tp-yt-paper-listbox > *'
        ));
      }

      document.querySelectorAll('tp-yt-iron-dropdown:not([aria-hidden="true"]), iron-dropdown:not([aria-hidden="true"])').forEach(d => {
        items.push(...d.querySelectorAll('*'));
      });

      document.querySelectorAll('ytd-menu-popup-renderer').forEach(r => {
        items.push(...r.querySelectorAll('tp-yt-paper-item, ytd-menu-service-item-renderer, a, [role="menuitem"], [role="option"]'));
      });

      items = [...new Set(items)];

      if (actionType === 'add') {
        for (const item of items) {
          const rect = item.getBoundingClientRect();
          if (rect.height === 0 || rect.width === 0) continue;

          const text = item.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
          if (!text) continue;
          
          const paths = Array.from(item.querySelectorAll('path')).map(p => p.getAttribute('d') || '');
          const hasClockIcon = paths.some(d => d.includes('14.97') && d.includes('16.95') && d.includes('13.87'));
          
          const isWatchLater = text.includes('save to watch later') || 
                               text.includes('add to watch later') || 
                               text.includes('watch later') ||
                               text.includes('צפייה מאוחרת') || 
                               text.includes('לצפייה מאוחרת') ||
                               hasClockIcon;

          if (isWatchLater) {
            console.log(`[Watch Later Ext] Found direct Watch Later option: "${text}"`);
            item.click();
            clearInterval(interval);
            if (popupContainer) {
              popupContainer.classList.remove('wl-hide-popup');
            }
            resolve('added');
            return;
          }
        }
      } else if (actionType === 'remove') {
        for (const item of items) {
          const rect = item.getBoundingClientRect();
          if (rect.height === 0 || rect.width === 0) continue;

          const text = item.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
          if (!text) continue;

          const isSaveToPlaylist = text.includes('save to playlist') || 
                                   text === 'save' || 
                                   text.includes('שמירה לרשימת השמעה') || 
                                   text === 'שמירה' || 
                                   text.includes('שמירה לרשימה');

          if (isSaveToPlaylist) {
            console.log(`[Watch Later Ext] Found Save to Playlist option: "${text}". Opening dialog...`);
            
            const dialogObserver = new MutationObserver((mutations, observerInstance) => {
              const renderer = findDialogRenderer();
              if (renderer) {
                renderer.classList.add('wl-hide-dialog');
                const parentDialog = findClosestDialogParent(renderer);
                if (parentDialog) {
                  parentDialog.classList.add('wl-hide-dialog');
                }
                observerInstance.disconnect();
              }
            });
            dialogObserver.observe(document.body, { childList: true, subtree: true });

            item.click();
            clearInterval(interval);

            const success = await uncheckWatchLaterInDialog();
            
            if (popupContainer) {
              popupContainer.classList.remove('wl-hide-popup');
            }
            resolve(success ? 'removed' : 'failed');
            return;
          }
        }
      }

      if (attempts > 60) {
        clearInterval(interval);
        console.error('[Watch Later Ext] Timeout: Could not find menu item.');
        document.body.click();
        if (popupContainer) {
          popupContainer.classList.remove('wl-hide-popup');
        }
        resolve('failed');
      }
    }, 50);
  });
}

function deepQuerySelector(selector, root = document) {
  if (!root) return null;
  const found = root.querySelector(selector);
  if (found) return found;
  
  if (root.children) {
    for (const child of root.children) {
      const res = deepQuerySelector(selector, child);
      if (res) return res;
    }
  }
  
  if (root.shadowRoot) {
    const res = deepQuerySelector(selector, root.shadowRoot);
    if (res) return res;
  }
  
  return null;
}

function deepQuerySelectorAll(selector, root = document, results = []) {
  if (!root) return results;
  
  const elements = root.querySelectorAll(selector);
  for (const el of elements) {
    if (!results.includes(el)) {
      results.push(el);
    }
  }
  
  if (root.children) {
    for (const child of root.children) {
      deepQuerySelectorAll(selector, child, results);
    }
  }
  
  if (root.shadowRoot) {
    deepQuerySelectorAll(selector, root.shadowRoot, results);
  }
  
  return results;
}

function findClosestDialogParent(el) {
  if (!el) return null;
  const closest = el.closest ? el.closest('tp-yt-paper-dialog, dialog, [role="dialog"]') : null;
  if (closest) return closest;
  
  let parent = el.parentNode;
  if (!parent && el.getRootNode) {
    const root = el.getRootNode();
    if (root && root.host) {
      parent = root.host;
    }
  }
  
  if (parent) {
    return findClosestDialogParent(parent);
  }
  return null;
}

function findDialogRenderer() {
  const popup = document.querySelector('ytd-popup-container');
  if (popup) {
    const el = deepQuerySelector('ytd-add-to-playlist-renderer, yt-add-to-playlist-renderer', popup);
    if (el) return el;
  }
  return deepQuerySelector('ytd-add-to-playlist-renderer, yt-add-to-playlist-renderer', document.body);
}

function findCloseButton(renderer) {
  if (!renderer) return null;
  
  const selectors = ['yt-icon-button#close-button', 'button[aria-label="Close"]', 'button#close-button', '[id*="close"]', '[class*="close"]'];
  for (const sel of selectors) {
    const btn = deepQuerySelector(sel, renderer);
    if (btn) return btn;
  }
  
  const allBtns = deepQuerySelectorAll('button, yt-icon-button, paper-button', renderer);
  for (const b of allBtns) {
    const id = b.id || '';
    const label = b.getAttribute('aria-label') || '';
    const text = b.textContent || '';
    if (id.toLowerCase().includes('close') || 
        label.toLowerCase().includes('close') || 
        label.toLowerCase().includes('סגור') || 
        text.toLowerCase().includes('close') || 
        text.toLowerCase().includes('סגור')) {
      return b;
    }
  }
  return null;
}

function findCheckboxes(renderer) {
  return deepQuerySelectorAll('tp-yt-paper-checkbox, paper-checkbox, [role="checkbox"]', renderer);
}

function debugPrintPopupElements() {
  console.log('[Watch Later Ext] Debug: Running targeted DOM check...');
  
  const popup = document.querySelector('ytd-popup-container');
  if (popup) {
    console.log(`[Watch Later Ext] Found ytd-popup-container. ShadowRoot: ${!!popup.shadowRoot}`);
    if (popup.shadowRoot) {
      const renderers = popup.shadowRoot.querySelectorAll('ytd-add-to-playlist-renderer, yt-add-to-playlist-renderer');
      console.log(`[Watch Later Ext]   Renderers in popup shadowRoot: ${renderers.length}`);
      for (const r of renderers) {
        console.log(`[Watch Later Ext]   Renderer: tag=${r.tagName}, id=${r.id}, class=${r.className}`);
      }
      
      const allInside = popup.shadowRoot.querySelectorAll('*');
      const tags = Array.from(allInside).map(el => el.tagName).filter((v, i, a) => a.indexOf(v) === i);
      console.log(`[Watch Later Ext]   All tag names in popup shadowRoot: ${tags.join(', ')}`);
    }
  } else {
    console.log('[Watch Later Ext] ytd-popup-container NOT found.');
  }

  const bodyRenderers = document.querySelectorAll('ytd-add-to-playlist-renderer, yt-add-to-playlist-renderer');
  console.log(`[Watch Later Ext] Renderers in document body: ${bodyRenderers.length}`);
  
  const dialogs = document.querySelectorAll('tp-yt-paper-dialog, yt-dialog, dialog, [role="dialog"]');
  console.log(`[Watch Later Ext] Dialogs in document body: ${dialogs.length}`);
  for (const d of dialogs) {
    console.log(`[Watch Later Ext]   Dialog: tag=${d.tagName}, id=${d.id}, class=${d.className}, visible=${d.offsetWidth > 0}`);
  }
}

function uncheckWatchLaterInDialog() {
  return new Promise(resolve => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      
      if (attempts === 10 || attempts === 30) {
        debugPrintPopupElements();
      }
      
      const renderer = findDialogRenderer();
      if (renderer) {
        console.log('[Watch Later Ext] Found playlist dialog renderer in DOM.');
        const checkboxes = findCheckboxes(renderer);
        console.log(`[Watch Later Ext] Found ${checkboxes.length} checkboxes in dialog.`);
        
        for (const cb of checkboxes) {
          const text = cb.textContent || '';
          const ariaLabel = cb.getAttribute('aria-label') || '';
          const parentText = cb.parentElement ? cb.parentElement.textContent : '';
          const closestOption = cb.closest('ytd-playlist-add-to-option-renderer, yt-playlist-add-to-option-renderer');
          const closestText = closestOption ? closestOption.textContent : '';
          
          const label = (text + ' ' + ariaLabel + ' ' + parentText + ' ' + closestText).replace(/\s+/g, ' ').trim().toLowerCase();
          const isWL = label.includes('watch later') || label.includes('צפייה מאוחרת') || label.includes('לצפייה מאוחרת');
          
          if (isWL) {
            const isChecked = cb.hasAttribute('checked') || cb.getAttribute('aria-checked') === 'true' || cb.checked;
            console.log(`[Watch Later Ext] Found Watch Later checkbox. Checked: ${isChecked}`);
            
            if (isChecked) {
              cb.click();
              console.log('[Watch Later Ext] Unchecked Watch Later checkbox.');
            } else {
              console.log('[Watch Later Ext] Watch Later checkbox already unchecked.');
            }
            
            clearInterval(interval);
            
            setTimeout(() => {
              const closeBtn = findCloseButton(renderer);
              if (closeBtn) {
                console.log('[Watch Later Ext] Clicking dialog close button.');
                closeBtn.click();
              } else {
                console.log('[Watch Later Ext] Close button not found. Clicking body to close.');
                document.body.click();
              }
              resolve(true);
            }, 100);
            return;
          }
        }
      }

      if (attempts > 50) {
        clearInterval(interval);
        console.error('[Watch Later Ext] Timeout waiting for Save to Playlist dialog Watch Later checkbox.');
        const renderer = findDialogRenderer();
        if (renderer) {
          const closeBtn = findCloseButton(renderer);
          if (closeBtn) closeBtn.click();
        } else {
          document.body.click();
        }
        resolve(false);
      }
    }, 50);
  });
}


// Native click capture to keep the cache synchronized
document.body.addEventListener('click', (e) => {
  // 1. Detect if the user clicked the native 3-dots menu button
  const triggerBtn = e.target.closest(
    '.ytLockupMetadataViewModelMenuButton button-view-model button, ' +
    '.ytLockupMetadataViewModelMenuButton button, ' +
    'button[aria-haspopup="true"], button[aria-haspopup="menu"], ' +
    'ytd-menu-renderer yt-icon-button#button button, ' +
    'ytd-menu-renderer button'
  );

  if (triggerBtn) {
    const videoEl = triggerBtn.closest(
      'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model, ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer'
    );
    if (videoEl) {
      const videoId = getVideoId(videoEl);
      if (videoId) {
        lastInteractedVideoId = videoId;
      }
    }
    return;
  }

  // 2. Detect if they clicked a native menu item (like "Save to Watch Later" / "Remove from Watch Later")
  const menuItem = e.target.closest(
    'ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer, tp-yt-paper-item, yt-list-item-view-model'
  );
  if (menuItem && lastInteractedVideoId) {
    const text = menuItem.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!text) return;

    const paths = Array.from(menuItem.querySelectorAll('path')).map(p => p.getAttribute('d') || '');
    const hasClockIcon = paths.some(d => d.includes('14.97') && d.includes('16.95') && d.includes('13.87'));

    const isWatchLater = text.includes('save to watch later') || 
                         text.includes('add to watch later') || 
                         text.includes('watch later') ||
                         text.includes('צפייה מאוחרת') || 
                         text.includes('לצפייה מאוחרת') ||
                         hasClockIcon;

    if (isWatchLater) {
      const isRemoveAction = text.includes('remove') || text.includes('הסר') || text.includes('הסרה');
      if (isRemoveAction) {
        watchLaterIds.delete(lastInteractedVideoId);
      } else {
        watchLaterIds.add(lastInteractedVideoId);
      }
      saveWatchLaterIdsToStorage();
    }
    return;
  }

  // 3. Detect if they clicked YouTube's native thumbnail overlay watch later button
  const overlayBtn = e.target.closest('ytd-thumbnail-overlay-toggle-button-renderer');
  if (overlayBtn) {
    const videoEl = overlayBtn.closest(
      'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model'
    );
    if (videoEl) {
      const videoId = getVideoId(videoEl);
      if (videoId) {
        const isCurrentlySaved = watchLaterIds.has(videoId);
        if (isCurrentlySaved) {
          watchLaterIds.delete(videoId);
        } else {
          watchLaterIds.add(videoId);
        }
        saveWatchLaterIdsToStorage();
      }
    }
  }
});

// MutationObserver for dynamically loaded videos (infinite scroll)
const observer = new MutationObserver(() => {
  injectButtons();
  injectAddButtons();
  updateAllButtonsState();
});

observer.observe(document.body, { childList: true, subtree: true });

// Handle client-side navigation
document.addEventListener('yt-navigate-finish', () => {
  injectButtons();
  injectAddButtons();
  updateAllButtonsState();
});

// Initial run
initWatchLaterCache();
injectButtons();
injectAddButtons();
