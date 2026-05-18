export async function setLatest(payload) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ psa_latest: payload }, () => resolve());
  });
}

export async function appendHistory(payload) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["psa_history"], (result) => {
      const history = Array.isArray(result.psa_history) ? result.psa_history : [];
      history.unshift(payload);
      chrome.storage.local.set({ psa_history: history.slice(0, 50) }, () => resolve());
    });
  });
}
