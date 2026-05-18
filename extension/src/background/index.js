import { analyzePolicy } from "../shared/policyAnalyzer.js";
import { appendHistory, setLatest } from "../shared/storage.js";

async function runAnalysis(payload, tabUrl) {
  const result = await analyzePolicy(payload);
  const enriched = {
    ...result,
    url: tabUrl || payload?.url || "",
    scanned_at: new Date().toISOString()
  };
  await setLatest(enriched);
  await appendHistory(enriched);
  await chrome.storage.local.set({ psa_latest_error: null });
  return enriched;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PSA_ANALYZE_TEXT") {
    runAnalysis(message.payload, sender?.tab?.url)
      .then((result) => sendResponse({ ok: true, result }))
      .catch(async (error) => {
        const messageText = error?.message || "Analysis failed";
        await chrome.storage.local.set({ psa_latest_error: messageText });
        sendResponse({ ok: false, error: messageText });
      });
    return true;
  }

  if (message?.type === "PSA_SCAN_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (!tab?.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "PSA_REQUEST_PAGE_CONTEXT" }, async (response) => {
        if (!response?.ok) {
          const messageText = response?.error || "Content script unavailable";
          await chrome.storage.local.set({ psa_latest_error: messageText });
          sendResponse({ ok: false, error: messageText });
          return;
        }
        try {
          const result = await runAnalysis(response.payload, tab.url);
          sendResponse({ ok: true, result });
        } catch (error) {
          const messageText = error?.message || "Analysis failed";
          await chrome.storage.local.set({ psa_latest_error: messageText });
          sendResponse({ ok: false, error: messageText });
        }
      });
    });
    return true;
  }

  sendResponse({ ok: false, error: "Unknown message" });
  return false;
});
