(() => {
  'use strict';
  if (window.__adHunterYouTubeV1) return;
  window.__adHunterYouTubeV1 = true;

  const ENABLED_ATTRIBUTE = 'data-adhunter-youtube-enabled';
  const SKIP_SELECTORS = 'button.ytp-skip-ad-button, button.ytp-ad-skip-button, button.ytp-ad-skip-button-modern';
  const MAX_AD_ATTEMPTS = 6;
  const RETRY_DELAY = 1000;
  let enabled = false;
  let suspended = false;
  let stateRevision = 0;
  let player = null;
  let playerObserver = null;
  let documentObserver = null;
  let workTimer = null;
  let retryTimer = null;
  let adActive = false;
  let adAttempts = 0;
  let skipAttempts = 0;
  let lastSkipAt = -Infinity;
  let mutedVideo = null;

  function isAdActive(element) {
    return Boolean(element?.isConnected && (
      element.classList.contains('ad-showing') ||
      element.classList.contains('ad-interrupting')
    ));
  }

  function restoreAudio() {
    if (!mutedVideo) return;
    // We only own a mute that changed an unmuted video. Do not change an
    // initially-muted video or undo an explicit unmute during the ad.
    if (mutedVideo.muted) mutedVideo.muted = false;
    mutedVideo = null;
  }

  function updateAudio() {
    const video = player?.querySelector('video') || null;
    if (video === mutedVideo) return;
    restoreAudio();
    if (video && !video.muted) {
      video.muted = true;
      mutedVideo = video;
    }
  }

  function clearTimers() {
    clearTimeout(workTimer);
    clearTimeout(retryTimer);
    workTimer = null;
    retryTimer = null;
  }

  function bindPlayer(next) {
    playerObserver?.disconnect();
    playerObserver = null;
    restoreAudio();
    player = next;
    adActive = false;
    adAttempts = 0;
    lastSkipAt = -Infinity;
    if (!player) return;
    playerObserver = new MutationObserver(() => schedule());
    playerObserver.observe(player, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'disabled', 'aria-disabled']
    });
  }

  function isAvailable(button) {
    if (!button.isConnected || button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
    if (!button.getClientRects().length) return false;
    for (let element = button; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' ||
          style.visibility === 'collapse' || Number(style.opacity) === 0) return false;
    }
    return true;
  }

  function update() {
    clearTimeout(workTimer);
    workTimer = null;
    clearTimeout(retryTimer);
    retryTimer = null;
    if (!enabled || suspended) return;
    document.documentElement?.setAttribute(ENABLED_ATTRIBUTE, 'true');
    const next = document.getElementById('movie_player');
    if (next !== player) bindPlayer(next);
    if (!isAdActive(player)) {
      restoreAudio();
      adActive = false;
      adAttempts = 0;
      lastSkipAt = -Infinity;
      return;
    }

    adActive = true;
    updateAudio();
    if (adAttempts >= MAX_AD_ATTEMPTS) return;
    const button = Array.from(player.querySelectorAll(SKIP_SELECTORS)).find(isAvailable);
    if (!button) return;
    const remaining = RETRY_DELAY - (Date.now() - lastSkipAt);
    if (remaining > 0) {
      retryTimer = setTimeout(update, remaining);
      return;
    }

    adAttempts++;
    skipAttempts++;
    lastSkipAt = Date.now();
    // This uses YouTube's own control. It deliberately does not seek, change
    // playback speed, remove player nodes, or alter player/network responses.
    button.click();
    if (enabled && !suspended && isAdActive(player) && adAttempts < MAX_AD_ATTEMPTS) {
      retryTimer = setTimeout(update, RETRY_DELAY);
    }
  }

  function schedule(delay = 100) {
    if (!enabled || suspended || workTimer !== null) return;
    workTimer = setTimeout(update, delay);
  }

  function stop() {
    clearTimers();
    documentObserver?.disconnect();
    documentObserver = null;
    bindPlayer(null);
    document.documentElement?.removeAttribute(ENABLED_ATTRIBUTE);
  }

  function setEnabled(value) {
    enabled = value === true;
    stop();
    if (!enabled || suspended) return;
    // A cheap ID lookup detects root/player replacement. All detailed queries
    // and attribute observations remain scoped to the player.
    documentObserver = new MutationObserver(() => {
      if (document.getElementById('movie_player') !== player ||
          !document.documentElement?.hasAttribute(ENABLED_ATTRIBUTE)) schedule();
    });
    documentObserver.observe(document, { childList: true, subtree: true });
    schedule(0);
  }

  async function readEnabledState() {
    const revision = stateRevision;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_AD_BLOCKER_STATE' });
      if (revision !== stateRevision || suspended) return;
      setEnabled(result?.ok === true && result.enabled === true);
    } catch {
      if (revision === stateRevision) setEnabled(false);
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'AD_BLOCKER_STATE_CHANGED') {
      stateRevision++;
      setEnabled(message.enabled);
      return false;
    }
    if (message?.type === 'GET_YOUTUBE_AD_STATE') {
      sendResponse({
        ok: true,
        enabled,
        adActive: enabled && !suspended && isAdActive(player),
        playerFound: Boolean(player?.isConnected),
        skipAttempts
      });
    }
    // Do not answer messages owned by the game or other content scripts.
    return false;
  });

  document.addEventListener('yt-navigate-finish', () => schedule(0));
  window.addEventListener('pagehide', () => {
    suspended = true;
    stateRevision++;
    stop();
  });
  window.addEventListener('pageshow', () => {
    if (!suspended) return;
    suspended = false;
    setEnabled(false);
    readEnabledState();
  });
  readEnabledState();
})();
