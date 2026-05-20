import {
  clamp,
  formatKeyLabel,
  getTruthyKeys,
  nowIso,
  truncate
} from "./utils/helpers.js";

const scanBtn = document.getElementById("scanBtn");
const loadingEl = document.getElementById("loading");
const loadingLog = document.getElementById("loadingLog");
const progressBar = document.getElementById("progressBar");
const errorEl = document.getElementById("error");
const errorMessage = document.getElementById("errorMessage");
const errorHint = document.getElementById("errorHint");
const resultsEl = document.getElementById("results");
const scoreRing = document.getElementById("scoreRing");
const scoreValue = document.getElementById("scoreValue");
const gradeValue = document.getElementById("gradeValue");
const riskBadge = document.getElementById("riskBadge");
const summaryText = document.getElementById("summaryText");
const policyUrlText = document.getElementById("policyUrlText");
const openPolicy = document.getElementById("openPolicy");
const scoreReasonsEl = document.getElementById("scoreReasons");
const highRiskItemsEl = document.getElementById("highRiskItems");
const attentionItemsEl = document.getElementById("attentionItems");
const normalItemsEl = document.getElementById("normalItems");
const redFlagsEl = document.getElementById("redFlags");
const trackersEl = document.getElementById("trackers");
const trackerNote = document.getElementById("trackerNote");
const trackerDetailsEl = document.getElementById("trackerDetails");
const dataCollectedEl = document.getElementById("dataCollected");
const permissionsEl = document.getElementById("permissions");
const privacyTipsEl = document.getElementById("privacyTips");
const deployLogEl = document.getElementById("deployLog");
const copySummaryBtn = document.getElementById("copySummary");
const exportReportBtn = document.getElementById("exportReport");
const historyList = document.getElementById("historyList");
const modelSelect = document.getElementById("modelSelect");
const modeSelect = document.getElementById("modeSelect");
const chunkLimitInput = document.getElementById("chunkLimit");
const rgbToggle = document.getElementById("rgbToggle");

let activeRequestId = null;
let lastReport = null;
let isScanning = false;

const TRACKER_DESCRIPTIONS = {
  google_analytics: "Google Analytics measures visits, pages, and user behavior.",
  google_tag_manager: "Google Tag Manager can load analytics, ad, and marketing scripts.",
  meta_pixel: "Meta Pixel can support ad targeting and conversion tracking.",
  tiktok_pixel: "TikTok Pixel can support ad targeting and campaign measurement.",
  twitter_pixel: "Twitter/X tracking can support ad measurement and retargeting.",
  linkedin_insight: "LinkedIn Insight can support business ad tracking and retargeting.",
  hotjar: "Hotjar can record usage behavior such as clicks, heatmaps, and sessions."
};

scanBtn.addEventListener("click", () => {
  if (isScanning) {
    cancelScan();
    return;
  }
  startScan();
});

[modelSelect, modeSelect, chunkLimitInput].forEach((control) => {
  control.addEventListener("change", saveSettings);
});

rgbToggle.addEventListener("click", () => {
  const enabled = !document.body.classList.contains("rgb-mode");
  applyRgbMode(enabled);
  saveSettings();
});

copySummaryBtn.addEventListener("click", async () => {
  if (!lastReport) return;
  const summary = lastReport.ai_report?.summary || "";
  try {
    await navigator.clipboard.writeText(summary);
    copySummaryBtn.textContent = "Copied";
  } catch {
    copySummaryBtn.textContent = "Copy Failed";
  }
  setTimeout(() => {
    copySummaryBtn.textContent = "Copy Summary";
  }, 1200);
});

exportReportBtn.addEventListener("click", () => {
  if (!lastReport) return;
  const payload = {
    exported_at: nowIso(),
    url: lastReport.url,
    policy_url: lastReport.policy_url,
    ai_report: lastReport.ai_report,
    local_trackers: lastReport.local_trackers
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "privacy-shield-report.json";
  link.click();
  URL.revokeObjectURL(url);
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.requestId !== activeRequestId) return;

  if (message.type === "SCAN_PROGRESS") {
    addLogLine(loadingLog, message.line);
    progressBar.style.width = `${message.progress || 0}%`;
  }

  if (message.type === "SCAN_ERROR") {
    setScanning(false);
    showError(message.error, message.hint);
  }

  if (message.type === "SCAN_RESULT") {
    setScanning(false);
    showResult(message.payload, { persist: true });
  }
});

initSavedState();

async function startScan() {
  resetUI();
  activeRequestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const settings = getSettings();
  await saveSettings();

  setScanning(true);
  showLoading(true);
  addLogLine(loadingLog, "[INIT] Preparing scan...");

  chrome.runtime.sendMessage(
    {
      type: "SCAN_REQUEST",
      requestId: activeRequestId,
      settings
    },
    (response) => {
      if (chrome.runtime.lastError) {
        setScanning(false);
        showError("Extension error", chrome.runtime.lastError.message);
        return;
      }
      if (response && response.accepted !== true) {
        setScanning(false);
        showError("Scan rejected", response?.message || "Unknown error");
      }
    }
  );
}

function cancelScan() {
  if (!activeRequestId) return;
  addLogLine(loadingLog, "[CANCEL] Stopping scan...");
  chrome.runtime.sendMessage({
    type: "CANCEL_SCAN",
    requestId: activeRequestId
  });
  setScanning(false);
}

function setScanning(value) {
  isScanning = value;
  scanBtn.textContent = value ? "Cancel Scan" : "Do Privacy Scan";
  scanBtn.classList.toggle("cancel-btn", value);
}

function resetUI() {
  showError(null, null, true);
  showLoading(false);
  resultsEl.classList.add("hidden");
  loadingLog.textContent = "";
  progressBar.style.width = "0%";
}

function showLoading(show) {
  loadingEl.classList.toggle("hidden", !show);
}

function showError(message, hint, keepLoading = false) {
  if (!keepLoading) {
    showLoading(false);
  }
  if (message) {
    errorMessage.textContent = message;
    errorHint.textContent = hint || "";
    errorEl.classList.remove("hidden");
  } else {
    errorEl.classList.add("hidden");
  }
}

function showResult(payload, options = {}) {
  showLoading(false);
  errorEl.classList.add("hidden");
  resultsEl.classList.remove("hidden");

  const report = payload.ai_report;
  lastReport = payload;

  const score = clamp(Number(report.privacy_score || 0), 0, 100);
  scoreValue.textContent = `${score}/100`;
  gradeValue.textContent = getGrade(score);
  scoreRing.style.background = buildScoreGradient(score);

  const risk = report.risk_level || "UNKNOWN";
  riskBadge.textContent = risk;
  applyRiskColor(riskBadge, risk);

  summaryText.textContent = truncate(
    report.summary || "No summary was generated for this scan.",
    520
  );

  renderPolicyLink(payload.policy_url);

  const redFlags = getTruthyKeys(report.red_flags);
  const dataCollected = getTruthyKeys(report.data_collected);
  const permissions = getTruthyKeys(report.permission_signals);
  renderList(redFlagsEl, redFlags);

  const trackerKeys = getTruthyKeys(report.trackers).filter(
    (key) => key !== "other_trackers"
  );
  const aiOtherTrackers = Array.isArray(report.trackers?.other_trackers)
    ? report.trackers.other_trackers.map((name) => `Other: ${name}`)
    : [];
  const combinedTrackers = mergeTrackers(
    [...trackerKeys, ...aiOtherTrackers],
    payload.local_trackers
  );
  renderList(trackersEl, combinedTrackers.items);
  trackerNote.textContent = combinedTrackers.hasLocal
    ? "Local detection confirms some trackers"
    : "";
  renderList(trackerDetailsEl, buildTrackerDetails(combinedTrackers.items));

  renderList(dataCollectedEl, dataCollected);
  renderList(permissionsEl, permissions);
  renderList(scoreReasonsEl, buildScoreReasons(score, redFlags, dataCollected, permissions, combinedTrackers.items));
  renderRiskGroups(redFlags, dataCollected, permissions);
  renderList(privacyTipsEl, buildPrivacyTips(redFlags, dataCollected, permissions, combinedTrackers.items));

  const logLines = Array.isArray(report.deploy_log)
    ? report.deploy_log
    : payload.deploy_log;
  renderTimeline(deployLogEl, logLines || []);

  if (options.persist) {
    saveLastScan(payload);
    updateHistory(payload);
  }
}

function addLogLine(target, line) {
  if (!line) return;
  const current = target.textContent.trim();
  target.textContent = current ? `${current}\n${line}` : line;
}

function renderList(target, items) {
  target.innerHTML = "";
  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "None detected";
    target.appendChild(li);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = formatKeyLabel(item);
    target.appendChild(li);
  });
}

function buildScoreGradient(score) {
  const width = clamp(Number(score || 0), 0, 100);
  const color = score >= 75 ? "#2bff88" : score >= 45 ? "#ffd75e" : "#ff3b6b";
  return `linear-gradient(90deg, ${color} 0%, ${color} ${width}%, rgba(43, 255, 136, 0.1) ${width}%, rgba(73, 215, 255, 0.08) 100%)`;
}

function renderTimeline(target, lines) {
  target.innerHTML = "";
  if (!lines || !lines.length) {
    target.textContent = "";
    return;
  }
  lines.filter(Boolean).forEach((line) => {
    const row = document.createElement("div");
    row.className = "timeline-row";
    const stage = document.createElement("span");
    stage.textContent = getTimelineStage(line);
    const text = document.createElement("p");
    text.textContent = String(line).replace(/^\[[^\]]+\]\s*/, "");
    row.append(stage, text);
    target.appendChild(row);
  });
}

function getTimelineStage(line) {
  const match = String(line || "").match(/^\[([^\]]+)\]/);
  return match ? match[1] : "LOG";
}

function getGrade(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

function renderPolicyLink(policyUrl) {
  if (!policyUrl) {
    policyUrlText.textContent = "No policy loaded";
    openPolicy.href = "#";
    openPolicy.classList.add("disabled");
    return;
  }
  policyUrlText.textContent = policyUrl;
  openPolicy.href = policyUrl;
  openPolicy.classList.remove("disabled");
}

function buildScoreReasons(score, redFlags, dataCollected, permissions, trackers) {
  const reasons = [];
  if (redFlags.includes("data_selling")) reasons.push("Data selling language was detected.");
  if (redFlags.includes("third_party_sharing")) reasons.push("Third-party sharing or service-provider sharing is mentioned.");
  if (redFlags.includes("behavioral_profiling")) reasons.push("Behavioral profiling or personalized ads are mentioned.");
  if (redFlags.includes("advertising_partners")) reasons.push("Advertising or marketing partners are mentioned.");
  if (redFlags.includes("children_data")) reasons.push("Children or minors are mentioned in the policy.");
  if (redFlags.includes("indefinite_retention")) reasons.push("Retention wording appears broad or indefinite.");
  if (redFlags.includes("weak_deletion_rights")) reasons.push("Retention is mentioned without clear deletion language nearby.");
  if (trackers.length) reasons.push(`${trackers.length} tracker signal${trackers.length === 1 ? "" : "s"} found.`);
  if (dataCollected.length) reasons.push(`${dataCollected.length} data type${dataCollected.length === 1 ? "" : "s"} detected.`);
  if (permissions.length) reasons.push(`${permissions.length} permission signal${permissions.length === 1 ? "" : "s"} mentioned.`);
  if (!reasons.length) reasons.push(score >= 75 ? "Few obvious privacy risks were detected." : "The score is based on limited detected policy signals.");
  return reasons.slice(0, 5);
}

function renderRiskGroups(redFlags, dataCollected, permissions) {
  const highRisk = redFlags.filter((key) =>
    ["data_selling", "biometric_data", "sensitive_data", "children_data", "indefinite_retention", "weak_deletion_rights"].includes(key)
  );
  const attention = redFlags.filter((key) => !highRisk.includes(key));
  const normal = dataCollected
    .filter((key) => !["biometric_data", "health_data", "location_data", "card_information"].includes(key))
    .concat(permissions.map((key) => `permission: ${key}`));

  renderList(highRiskItemsEl, highRisk);
  renderList(attentionItemsEl, attention);
  renderList(normalItemsEl, normal.slice(0, 8));
}

function buildTrackerDetails(trackers) {
  return trackers.map((tracker) => {
    const key = String(tracker || "").replace(/^Other:\s*/i, "").toLowerCase();
    const normalized = key.replace(/[\s-]+/g, "_");
    return TRACKER_DESCRIPTIONS[normalized] || `${tracker} may be used for analytics, ads, or behavior measurement.`;
  });
}

function buildPrivacyTips(redFlags, dataCollected, permissions, trackers) {
  const tips = [];
  if (dataCollected.includes("email")) tips.push("Use an alias email when signing up if the site does not need your main address.");
  if (dataCollected.includes("payment_information") || dataCollected.includes("card_information")) tips.push("Avoid saving payment details unless you trust the site.");
  if (dataCollected.includes("location_data") || permissions.includes("location")) tips.push("Deny location access unless the feature truly needs it.");
  if (redFlags.includes("third_party_sharing")) tips.push("Review cookie and sharing choices before creating an account.");
  if (redFlags.includes("data_selling")) tips.push("Look for opt-out rights under privacy choices or regional privacy laws.");
  if (redFlags.includes("children_data")) tips.push("Avoid letting children use the site without checking the children privacy section.");
  if (redFlags.includes("weak_deletion_rights")) tips.push("Look for account deletion and data deletion options before sharing sensitive information.");
  if (trackers.length) tips.push("Use browser tracking protection and reject optional cookies when possible.");
  if (!tips.length) tips.push("Still avoid sharing unnecessary personal information.");
  return tips.slice(0, 5);
}

function applyRiskColor(el, risk) {
  const level = risk.toUpperCase();
  if (level === "LOW") {
    el.style.color = "#2bff88";
    el.style.borderColor = "rgba(43, 255, 136, 0.6)";
    el.style.background = "rgba(43, 255, 136, 0.15)";
  } else if (level === "MEDIUM") {
    el.style.color = "#ffd75e";
    el.style.borderColor = "rgba(255, 215, 94, 0.6)";
    el.style.background = "rgba(255, 215, 94, 0.15)";
  } else if (level === "HIGH" || level === "CRITICAL") {
    el.style.color = "#ff3b6b";
    el.style.borderColor = "rgba(255, 59, 107, 0.6)";
    el.style.background = "rgba(255, 59, 107, 0.15)";
  } else {
    el.style.color = "#8fb3a2";
    el.style.borderColor = "rgba(143, 179, 162, 0.4)";
    el.style.background = "rgba(143, 179, 162, 0.1)";
  }
}

function mergeTrackers(aiTrackers, localTrackers) {
  const result = new Map();
  let hasLocal = false;

  aiTrackers.forEach((name) => {
    result.set(name, { label: name, local: false });
  });

  Object.entries(localTrackers || {}).forEach(([key, value]) => {
    if (key === "other_trackers") return;
    if (!value) return;
    hasLocal = true;
    if (!result.has(key)) {
      result.set(key, { label: key, local: true });
    }
  });

  (localTrackers?.other_trackers || []).forEach((domain) => {
    if (!domain) return;
    hasLocal = true;
    const label = `Other: ${domain}`;
    if (!result.has(label)) {
      result.set(label, { label, local: true });
    }
  });

  return { items: Array.from(result.values()).map((item) => item.label), hasLocal };
}

async function initSavedState() {
  const stored = await chrome.storage.local.get(["last_scan", "scan_history", "scan_settings"]);
  applySettings(stored.scan_settings || {});
  renderHistory(stored.scan_history || []);
  if (stored.last_scan) {
    showResult(stored.last_scan);
  }
}

function getSettings() {
  const chunks = clamp(Number(chunkLimitInput.value || 3), 2, 10);
  return {
    model: modelSelect.value || "tinyllama",
    mode: modeSelect.value || "fast",
    chunkLimit: chunks,
    rgbMode: document.body.classList.contains("rgb-mode")
  };
}

async function saveSettings() {
  await chrome.storage.local.set({ scan_settings: getSettings() });
}

function applySettings(settings) {
  const model = settings.model === "qwen2.5" ? "qwen2.5:0.5b" : settings.model;
  modelSelect.value = model || "tinyllama";
  modeSelect.value = settings.mode || "fast";
  chunkLimitInput.value = clamp(Number(settings.chunkLimit || 3), 2, 10);
  applyRgbMode(Boolean(settings.rgbMode));
}

function applyRgbMode(enabled) {
  document.body.classList.toggle("rgb-mode", enabled);
  rgbToggle.textContent = enabled ? "RGB On" : "RGB Off";
}

async function saveLastScan(payload) {
  await chrome.storage.local.set({ last_scan: payload });
}

async function initHistory() {
  const stored = await chrome.storage.local.get("scan_history");
  renderHistory(stored.scan_history || []);
}

async function updateHistory(payload) {
  const stored = await chrome.storage.local.get("scan_history");
  const history = stored.scan_history || [];
  const entry = {
    scanned_at: nowIso(),
    url: payload.url,
    policy_url: payload.policy_url,
    score: payload.ai_report.privacy_score,
    risk: payload.ai_report.risk_level,
    summary: payload.ai_report.summary
  };
  history.unshift(entry);
  const trimmed = history.slice(0, 8);
  await chrome.storage.local.set({ scan_history: trimmed });
  renderHistory(trimmed);
}

function renderHistory(history) {
  historyList.innerHTML = "";
  if (!history.length) {
    historyList.textContent = "No scans yet.";
    return;
  }
  history.slice(0, 4).forEach((item) => {
    const row = document.createElement("div");
    let domain = item.url;
    try {
      domain = new URL(item.url).hostname;
    } catch {
      domain = item.url;
    }
    row.textContent = `${domain} - ${item.score}/100 - ${item.risk}`;
    historyList.appendChild(row);
  });
}
