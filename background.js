const AD_RULESET_ID = 'adblock_rules';

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.error('Failed to configure side panel behavior:', error);
  }
});

async function getAdBlockerEnabled() {
  const enabledRulesets = await chrome.declarativeNetRequest.getEnabledRulesets();
  return enabledRulesets.includes(AD_RULESET_ID);
}

async function setAdBlockerEnabled(enabled) {
  const options = enabled
    ? { enableRulesetIds: [AD_RULESET_ID] }
    : { disableRulesetIds: [AD_RULESET_ID] };

  await chrome.declarativeNetRequest.updateEnabledRulesets(options);
  return enabled;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case 'STORE_REMOVED_ELEMENT': {
        const tabId = sender.tab?.id ?? message.payload?.tabId;
        if (typeof tabId !== 'number') {
          sendResponse({ ok: false, error: 'Missing tab id.' });
          return;
        }

        const payload = { ...message.payload, tabId };
        const key = `removed_${tabId}_${payload.id}`;
        
        await chrome.storage.session.set({ [key]: payload });
        
        const all = await chrome.storage.session.get(null);
        const count = Object.keys(all).filter(k => k.startsWith(`removed_${tabId}_`)).length;
        sendResponse({ ok: true, tabId, count });
        return;
      }

      case 'GET_REMOVED_ELEMENTS': {
        const tabId = message.tabId;
        const all = await chrome.storage.session.get(null);
        const records = Object.keys(all)
          .filter(k => k.startsWith(`removed_${tabId}_`))
          .map(k => all[k])
          .sort((a, b) => new Date(b.removedAt) - new Date(a.removedAt));
        sendResponse({ ok: true, records });
        return;
      }

      case 'DELETE_REMOVED_ELEMENT_RECORD': {
        const { tabId, removeId } = message;
        await chrome.storage.session.remove(`removed_${tabId}_${removeId}`);
        const all = await chrome.storage.session.get(null);
        const records = Object.keys(all)
          .filter(k => k.startsWith(`removed_${tabId}_`))
          .map(k => all[k])
          .sort((a, b) => new Date(b.removedAt) - new Date(a.removedAt));
        sendResponse({ ok: true, records });
        return;
      }

      case 'CLEAR_TAB_RECORDS': {
        const tabId = message.tabId;
        const all = await chrome.storage.session.get(null);
        const keysToRemove = Object.keys(all).filter(k => k.startsWith(`removed_${tabId}_`));
        await chrome.storage.session.remove(keysToRemove);
        sendResponse({ ok: true });
        return;
      }

      case 'GET_AD_BLOCKER_STATE': {
        sendResponse({ ok: true, enabled: await getAdBlockerEnabled() });
        return;
      }

      case 'SET_AD_BLOCKER_STATE': {
        const enabled = await setAdBlockerEnabled(Boolean(message.enabled));
        sendResponse({ ok: true, enabled });
        return;
      }

      default:
        sendResponse({ ok: false, error: 'Unknown message type.' });
    }
  })().catch((error) => {
    console.error(error);
    sendResponse({ ok: false, error: error?.message || 'Unexpected error.' });
  });

  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    try {
      const all = await chrome.storage.session.get(null);
      const keysToRemove = Object.keys(all).filter(k => k.startsWith(`removed_${tabId}_`));
      if (keysToRemove.length > 0) {
        await chrome.storage.session.remove(keysToRemove);
      }
    } catch (error) {
      console.error('Failed to clean up tab storage on navigation:', error);
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const all = await chrome.storage.session.get(null);
    const keysToRemove = Object.keys(all).filter(k => k.startsWith(`removed_${tabId}_`));
    if (keysToRemove.length > 0) {
      await chrome.storage.session.remove(keysToRemove);
    }
  } catch (error) {
    console.error('Failed to clean up tab storage:', error);
  }
});