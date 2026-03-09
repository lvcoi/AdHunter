const STORAGE_KEY = 'removedElementsByTab';
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
  return getAdBlockerEnabled();
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

        const payload = {
          ...message.payload,
          tabId
        };

        const current = await chrome.storage.local.get(STORAGE_KEY);
        const byTab = current[STORAGE_KEY] || {};
        const records = Array.isArray(byTab[tabId]) ? byTab[tabId] : [];
        records.unshift(payload);
        byTab[tabId] = records;
        await chrome.storage.local.set({ [STORAGE_KEY]: byTab });
        sendResponse({ ok: true, tabId, count: records.length });
        return;
      }

      case 'GET_REMOVED_ELEMENTS': {
        const tabId = message.tabId;
        const current = await chrome.storage.local.get(STORAGE_KEY);
        const byTab = current[STORAGE_KEY] || {};
        sendResponse({ ok: true, records: byTab[tabId] || [] });
        return;
      }

      case 'DELETE_REMOVED_ELEMENT_RECORD': {
        const { tabId, removeId } = message;
        const current = await chrome.storage.local.get(STORAGE_KEY);
        const byTab = current[STORAGE_KEY] || {};
        const records = Array.isArray(byTab[tabId]) ? byTab[tabId] : [];
        byTab[tabId] = records.filter((item) => item.id !== removeId);
        await chrome.storage.local.set({ [STORAGE_KEY]: byTab });
        sendResponse({ ok: true, records: byTab[tabId] });
        return;
      }

      case 'CLEAR_TAB_RECORDS': {
        const { tabId } = message;
        const current = await chrome.storage.local.get(STORAGE_KEY);
        const byTab = current[STORAGE_KEY] || {};
        delete byTab[tabId];
        await chrome.storage.local.set({ [STORAGE_KEY]: byTab });
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
