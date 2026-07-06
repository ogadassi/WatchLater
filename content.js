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

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Find the native 3-dots menu button and click it
      // YouTube uses different tags depending on the UI version
      const threeDotsBtn = video.querySelector('ytd-menu-renderer yt-icon-button#button, ytd-menu-renderer yt-button-shape button, ytd-menu-renderer .dropdown-trigger');
      
      if (!threeDotsBtn) {
        console.error('Watch Later Extension: Could not find the 3-dots menu button.');
        return;
      }
      
      // Hide the popup container temporarily to prevent the menu from flashing on screen
      const popupContainer = document.querySelector('ytd-popup-container');
      if (popupContainer) {
        popupContainer.style.opacity = '0';
        popupContainer.style.pointerEvents = 'none';
      }

      threeDotsBtn.click();

      // Wait for the popup menu to appear and find the remove option
      const clicked = await clickRemoveOption();
      if (!clicked) {
        console.error('Watch Later Extension: Could not find the "Remove from Watch later" option in the menu.');
        // Try to close the menu if we failed to find the option, so it doesn't stay open
        threeDotsBtn.click(); 
      }

      // Restore the popup container visibility after a short delay
      if (popupContainer) {
        setTimeout(() => {
          popupContainer.style.opacity = '';
          popupContainer.style.pointerEvents = '';
        }, 150);
      }
    });

    // Insert our button before the existing menu button so it appears to the left of the 3 dots
    menuContainer.insertBefore(btn, menuContainer.firstChild);
  });
}

function clickRemoveOption() {
  return new Promise(resolve => {
    let attempts = 0;
    let foundItemsLog = [];

    const interval = setInterval(() => {
      attempts++;
      
      // Query all possible menu items in the document
      const items = document.querySelectorAll('ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer, tp-yt-paper-item');
      for (const item of items) {
        // Check if item is actually visible on screen
        if (item.getBoundingClientRect().height === 0) continue;

        const text = item.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
        const html = item.innerHTML;
        
        if (text && !foundItemsLog.includes(text)) {
          foundItemsLog.push(text);
        }

        // Look for text or the trash can SVG path
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

      if (attempts > 50) { // Timeout after 2.5 seconds
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

  // Only match outermost card containers (added yt-lockup-view-model for sidebar videos)
  const videos = document.querySelectorAll(
    'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model'
  );
  
  videos.forEach(video => {
    // Avoid double-injecting if yt-lockup-view-model is nested inside another video container
    if (video.tagName.toLowerCase() === 'yt-lockup-view-model' && 
        video.parentElement.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer')) {
      return;
    }

    if (video.querySelector('.wl-custom-add-btn')) return;

    // Find the menu button container.
    // NEW YouTube layout: .ytLockupMetadataViewModelMenuButton
    // OLD YouTube layout: #menu, ytd-menu-renderer
    // Sidebar/compact: button-view-model, or class containing MenuButton
    let menuContainer = video.querySelector('.ytLockupMetadataViewModelMenuButton') ||
                        video.querySelector('[class*="MenuButton"]') ||
                        video.querySelector('#menu') ||
                        video.querySelector('ytd-menu-renderer');

    if (!menuContainer) return;

    const btn = document.createElement('button');
    btn.className = 'wl-custom-add-btn';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" style="width:24px;height:24px;">
         <g><path d="M14.97 16.95 10 13.87V7h2v5.76l4.03 2.49-1.06 1.7zM12 3c-4.96 0-9 4.04-9 9s4.04 9 9 9 9-4.04 9-9-4.04-9-9-9m0-1c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"></path></g>
      </svg>
    `;
    btn.title = "Add to Watch Later";

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const videoEl = btn.closest(
        'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model'
      );
      
      if (!videoEl) {
        return;
      }

      // At CLICK TIME, find the 3-dots button in the LIVE DOM.
      // NEW layout: button inside button-view-model inside .ytLockupMetadataViewModelMenuButton
      // OLD layout: yt-icon-button#button inside ytd-menu-renderer
      let triggerBtn = videoEl.querySelector('.ytLockupMetadataViewModelMenuButton button-view-model button') ||
                       videoEl.querySelector('.ytLockupMetadataViewModelMenuButton button') ||
                       videoEl.querySelector('button[aria-haspopup="true"], button[aria-haspopup="menu"]') ||
                       videoEl.querySelector('ytd-menu-renderer yt-icon-button#button button') ||
                       videoEl.querySelector('ytd-menu-renderer button');

      if (!triggerBtn) {
        return;
      }

      // Hide the popup so the menu doesn't flash on screen
      const popupContainer = document.querySelector('ytd-popup-container');
      if (popupContainer) {
        popupContainer.style.opacity = '0';
        popupContainer.style.pointerEvents = 'none';
      }

      // Click the 3-dots to open the popup
      triggerBtn.click();

      const status = await clickAddOption();
      
      // Restore popup visibility
      if (popupContainer) {
        popupContainer.style.opacity = '';
        popupContainer.style.pointerEvents = '';
      }

      if (status === 'failed') {
         document.body.click();
      }
    });

    // Append our button into the menu container, right after the 3-dots
    menuContainer.appendChild(btn);
  });
}

function clickAddOption() {
  return new Promise(resolve => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      
      // Search ALL possible popup/dropdown containers
      // YouTube may use ytd-popup-container, iron-dropdown, tp-yt-iron-dropdown, or just floating divs
      let items = [];

      // Strategy 1: Look inside ytd-popup-container
      const popupContainer = document.querySelector('ytd-popup-container');
      if (popupContainer) {
        items.push(...popupContainer.querySelectorAll(
          'ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer, ' +
          'tp-yt-paper-item, yt-list-item-view-model, ' +
          'ytd-menu-popup-renderer tp-yt-paper-listbox > *'
        ));
      }

      // Strategy 2: Look for any open dropdown/popup on the page
      document.querySelectorAll('tp-yt-iron-dropdown:not([aria-hidden="true"]), iron-dropdown:not([aria-hidden="true"])').forEach(d => {
        items.push(...d.querySelectorAll('*'));
      });

      // Strategy 3: Look for the popup renderer directly
      document.querySelectorAll('ytd-menu-popup-renderer').forEach(r => {
        items.push(...r.querySelectorAll('tp-yt-paper-item, ytd-menu-service-item-renderer, a, [role="menuitem"], [role="option"]'));
      });

      // Deduplicate
      items = [...new Set(items)];

      for (const item of items) {
        const rect = item.getBoundingClientRect();
        if (rect.height === 0 || rect.width === 0) continue;

        const text = item.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
        if (!text) continue;
        
        // Check SVG paths for the clock icon (language-agnostic)
        const paths = Array.from(item.querySelectorAll('path')).map(p => p.getAttribute('d') || '');
        const hasClockIcon = paths.some(d => d.includes('14.97') && d.includes('16.95') && d.includes('13.87'));
        
        // Match by text (English + Hebrew) or by SVG icon
        const isWatchLater = text.includes('save to watch later') || 
                             text.includes('add to watch later') || 
                             text.includes('watch later') ||
                             text.includes('צפייה מאוחרת') || 
                             text.includes('לצפייה מאוחרת') ||
                             hasClockIcon;
        
        const isRemoveAction = text.includes('remove') || text.includes('הסר') || text.includes('הסרה');

        if (isWatchLater && !isRemoveAction) {
          item.click();
          clearInterval(interval);
          resolve('added');
          return;
        } else if (isWatchLater && isRemoveAction) {
          document.body.click();
          clearInterval(interval);
          resolve('already_there');
          return;
        }
      }

      if (attempts > 60) {
        clearInterval(interval);
        // Log ALL visible text in the popup for debugging
        const debugTexts = items
          .filter(i => i.getBoundingClientRect().height > 0 && i.textContent.trim())
          .map(i => `[${i.tagName}] ${i.textContent.trim().substring(0, 80)}`)
          .filter((v, i, a) => a.indexOf(v) === i); // dedupe
        console.error('[Watch Later Ext] Timed out. All visible popup elements:', debugTexts);
        document.body.click();
        resolve('failed');
      }
    }, 50);
  });
}

// MutationObserver for dynamically loaded videos (infinite scroll)
const observer = new MutationObserver(() => {
  injectButtons();
  injectAddButtons();
});

observer.observe(document.body, { childList: true, subtree: true });

// Handle client-side navigation
document.addEventListener('yt-navigate-finish', () => {
  injectButtons();
  injectAddButtons();
});

// Initial run
injectButtons();
injectAddButtons();
