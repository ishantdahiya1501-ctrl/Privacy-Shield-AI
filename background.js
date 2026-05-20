import {
  clamp,
  cleanText,
  dedupe,
  extractJsonObject,
  isValidUrl,
  nowIso,
  truncate
} from "./utils/helpers.js";

const POLICY_PATHS = [
  "/privacy",
  "/privacy/",
  "/privacy.html",
  "/privacy-policy.html",
  "/privacy-policy",
  "/privacy-policy/",
  "/privacy_policy",
  "/privacy_policy/",
  "/privacy-notice",
  "/privacy-notice/",
  "/privacy-center",
  "/privacy-center/",
  "/privacy-statement",
  "/privacy-statement/",
  "/policies/privacy",
  "/policy/privacy-policy",
  "/legal/privacy-policy",
  "/legal",
  "/legal/privacy",
  "/terms",
  "/terms-of-service",
  "/terms-and-conditions"
];

const LINK_KEYWORDS = [
  "privacy",
  "policy",
  "data",
  "legal",
  "terms",
  "compliance"
];

const TRUSTED_POLICY_HOSTS = [
  "iubenda.com",
  "privacypolicies.com",
  "termly.io",
  "termsfeed.com",
  "cookieyes.com",
  "onetrust.com",
  "osano.com"
];

const AI_TASKS = [
  {
    resultKey: "data_collected",
    question: "Which data types are clearly collected?",
    allowedKeys: [
      "email",
      "phone",
      "address",
      "payment_information",
      "card_information",
      "location_data",
      "biometric_data",
      "health_data",
      "contacts",
      "messages",
      "files",
      "photos",
      "browsing_activity",
      "device_information",
      "government_id"
    ]
  },
  {
    resultKey: "red_flags",
    question: "Which privacy red flags are clearly present?",
    allowedKeys: [
      "data_selling",
      "third_party_sharing",
      "biometric_data",
      "location_tracking",
      "indefinite_retention",
      "ai_training_usage",
      "sensitive_data",
      "behavioral_profiling",
      "dark_patterns",
      "cookie_manipulation",
      "children_data",
      "advertising_partners",
      "weak_deletion_rights"
    ]
  },
  {
    resultKey: "permission_signals",
    question: "Which permission signals are clearly mentioned?",
    allowedKeys: [
      "camera",
      "microphone",
      "location",
      "contacts",
      "notifications",
      "bluetooth",
      "calendar"
    ]
  },
  {
    resultKey: "trackers",
    question: "Which tracker technologies are clearly mentioned?",
    allowedKeys: [
      "google_analytics",
      "google_tag_manager",
      "meta_pixel",
      "tiktok_pixel",
      "twitter_pixel",
      "linkedin_insight",
      "hotjar"
    ]
  },
  {
    resultKey: "privacy_score",
    question:
      "Give a privacy score (0-100), a risk level (LOW, MEDIUM, HIGH, CRITICAL), and a short warning if needed."
  }
];

const SUMMARY_TASK = {
  resultKey: "summary",
  question: "Write a short useful privacy summary for a normal user."
};

const DEFAULT_RED_FLAGS = {
  data_selling: "UNKNOWN",
  third_party_sharing: "UNKNOWN",
  biometric_data: "UNKNOWN",
  location_tracking: "UNKNOWN",
  indefinite_retention: "UNKNOWN",
  ai_training_usage: "UNKNOWN",
  sensitive_data: "UNKNOWN",
  behavioral_profiling: "UNKNOWN",
  dark_patterns: "UNKNOWN",
  cookie_manipulation: "UNKNOWN",
  children_data: "UNKNOWN",
  advertising_partners: "UNKNOWN",
  weak_deletion_rights: "UNKNOWN"
};

const DEFAULT_TRACKERS = {
  google_analytics: "UNKNOWN",
  google_tag_manager: "UNKNOWN",
  meta_pixel: "UNKNOWN",
  tiktok_pixel: "UNKNOWN",
  twitter_pixel: "UNKNOWN",
  linkedin_insight: "UNKNOWN",
  hotjar: "UNKNOWN",
  other_trackers: []
};

const DEFAULT_DATA_COLLECTED = {
  email: "UNKNOWN",
  phone: "UNKNOWN",
  address: "UNKNOWN",
  payment_information: "UNKNOWN",
  card_information: "UNKNOWN",
  location_data: "UNKNOWN",
  biometric_data: "UNKNOWN",
  health_data: "UNKNOWN",
  contacts: "UNKNOWN",
  messages: "UNKNOWN",
  files: "UNKNOWN",
  photos: "UNKNOWN",
  browsing_activity: "UNKNOWN",
  device_information: "UNKNOWN",
  government_id: "UNKNOWN"
};

const DEFAULT_PERMISSIONS = {
  camera: "UNKNOWN",
  microphone: "UNKNOWN",
  location: "UNKNOWN",
  contacts: "UNKNOWN",
  notifications: "UNKNOWN",
  bluetooth: "UNKNOWN",
  calendar: "UNKNOWN"
};

const DEFAULT_SCAN_SETTINGS = {
  model: "tinyllama",
  mode: "fast",
  chunkLimit: 3
};

const MODEL_ALIASES = {
  "qwen2.5": "qwen2.5:0.5b"
};

const MODEL_LABELS = {
  tinyllama: "TinyLlama",
  gemma4: "Gemma 4",
  "qwen2.5:0.5b": "Qwen2.5 0.5B"
};

const activeScans = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;

  if (message.type === "CANCEL_SCAN") {
    cancelScan(message.requestId);
    sendResponse({ cancelled: true });
    return false;
  }

  if (message.type !== "SCAN_REQUEST") return;
  const requestId = message.requestId;
  const settings = normalizeScanSettings(message.settings);

  sendResponse({ accepted: true });

  const scanState = {
    cancelled: false,
    controllers: new Set()
  };
  activeScans.set(requestId, scanState);

  runScan(requestId, settings, scanState).finally(() => {
    activeScans.delete(requestId);
  });

  return false;
});

async function runScan(requestId, settings = DEFAULT_SCAN_SETTINGS, scanState) {
  const log = (line, progress = 0) =>
    chrome.runtime.sendMessage({
      type: "SCAN_PROGRESS",
      requestId,
      line,
      progress
    });

  try {
    log("[SCAN] Searching website pages...", 10);
    throwIfCancelled(scanState);
    const tab = await getActiveTab();
    if (!tab || !tab.url) {
      throw new Error("No active tab detected");
    }

    const tabUrl = new URL(tab.url);
    const contentSignal = await getContentSignals(tab.id);

    let policyText = "";
    let policyUrl = "";
    let policyHtml = "";

    if (contentSignal.isPrivacyPage && contentSignal.policyText) {
      policyText = contentSignal.policyText;
      policyUrl = tab.url;
    } else {
      const candidates = buildCandidateUrls(tabUrl, contentSignal.linkCandidates);
      const result = await findPolicyPage(candidates, log);
      policyText = result.text;
      policyUrl = result.url;
      policyHtml = result.html;
    }

    if (!policyText) {
      throw new Error("Privacy policy not found");
    }

    log("[FOUND] Privacy Policy detected", 35);
    throwIfCancelled(scanState);
    log("[FETCH] Extracting policy text...", 45);

    const trackerSignals = detectTrackers(
      contentSignal.scriptSources,
      contentSignal.inlineScripts,
      policyHtml
    );

    log("[TRACKERS] Detecting tracking technologies...", 55);

    const modelLabel = formatModelLabel(settings.model);
    log(`[AI] Running ${modelLabel} analysis...`, 65);

    const aiReport = await analyzePolicy(policyText, trackerSignals, log, settings, scanState);

    log("[SCORE] Calculating privacy score...", 80);
    log("[DONE] Scan completed successfully", 100);

    chrome.runtime.sendMessage({
      type: "SCAN_RESULT",
      requestId,
      payload: {
        url: tab.url,
        policy_url: policyUrl,
        ai_report: aiReport,
        local_trackers: trackerSignals,
        deploy_log: aiReport.deploy_log,
        scanned_at: nowIso()
      }
    });
  } catch (error) {
    chrome.runtime.sendMessage({
      type: "SCAN_ERROR",
      requestId,
      error: error?.message || "Scan failed",
      hint: error?.hint || ""
    });
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });
  return tabs[0];
}

async function getContentSignals(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "GET_POLICY_LINKS"
    });
    return {
      linkCandidates: response?.links || [],
      scriptSources: response?.scriptSources || [],
      inlineScripts: response?.inlineScripts || [],
      isPrivacyPage: response?.isPrivacyPage || false,
      policyText: response?.policyText || ""
    };
  } catch {
    return {
      linkCandidates: [],
      scriptSources: [],
      inlineScripts: [],
      isPrivacyPage: false,
      policyText: ""
    };
  }
}

function buildCandidateUrls(tabUrl, linkCandidates) {
  const base = `${tabUrl.protocol}//${tabUrl.host}`;
  const candidates = [];
  POLICY_PATHS.forEach((path) => {
    candidates.push({
      url: `${base}${path}`,
      evidence: path
    });
  });

  (linkCandidates || []).forEach((link) => {
    const href = typeof link === "string" ? link : link.href;
    if (!isValidUrl(href)) return;
    try {
      const url = new URL(href);
      if (!isPolicyLinkHost(url, tabUrl)) return;
      if (url.pathname.length > 120) return;
      const keywordMatch = LINK_KEYWORDS.some((kw) => {
        const value = `${url.href} ${link?.text || ""} ${link?.aria || ""}`.toLowerCase();
        return value.includes(kw);
      });
      if (keywordMatch) {
        candidates.push({
          url: url.href,
          evidence: `${link?.text || ""} ${link?.aria || ""} ${url.pathname}`
        });
      }
    } catch {
      return;
    }
  });

  const seen = new Set();
  return candidates
    .filter((candidate) => {
      if (seen.has(candidate.url)) return false;
      seen.add(candidate.url);
      return true;
    })
    .slice(0, 18);
}

async function findPolicyPage(candidates, log) {
  for (const candidate of candidates) {
    const candidateUrl = typeof candidate === "string" ? candidate : candidate.url;
    const evidence = typeof candidate === "string" ? candidate : candidate.evidence;
    log(`[TRY] ${candidateUrl}`, 25);
    const html = await fetchHtml(candidateUrl);
    if (!html) continue;
    const text = extractPolicyText(html);
    if (!text) continue;
    const isPolicy = isPrivacyText(text, html, evidence);
    if (!isPolicy) continue;
    return {
      url: candidateUrl,
      text,
      html
    };
  }
  throw new Error("Privacy policy not found");
}

function isPolicyLinkHost(url, tabUrl) {
  if (url.host === tabUrl.host) return true;
  if (getBaseDomain(url.hostname) === getBaseDomain(tabUrl.hostname)) return true;
  return TRUSTED_POLICY_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

function getBaseDomain(hostname) {
  const parts = String(hostname || "").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-2).join(".");
}

async function fetchHtml(url) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) return "";
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return "";
    const html = await response.text();
    return html;
  } catch {
    return "";
  }
}

function extractPolicyText(html) {
  if (!html) return "";
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<canvas[\s\S]*?<\/canvas>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return cleanText(stripped);
}

function isPrivacyText(text, html, evidence = "") {
  const lower = text.toLowerCase();
  if (
    lower.includes("privacy policy") ||
    lower.includes("privacy notice") ||
    lower.includes("privacy statement") ||
    lower.includes("data protection")
  ) {
    return true;
  }
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || ["", ""])[1];
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || ["", ""])[1];
  return /privacy|data protection|privacy notice|privacy statement/i.test(
    `${title} ${h1} ${evidence}`
  );
}

function normalizeScanSettings(settings = {}) {
  const model = normalizeModelName(settings.model);
  const mode = settings.mode === "deep" ? "deep" : "fast";
  const chunkLimit = clamp(Number(settings.chunkLimit || DEFAULT_SCAN_SETTINGS.chunkLimit), 2, 10);
  return { model, mode, chunkLimit };
}

function normalizeModelName(value) {
  const raw = String(value || "").trim().toLowerCase();
  const normalized = MODEL_ALIASES[raw] || raw;
  const allowed = ["tinyllama", "gemma4", "qwen2.5:0.5b"];
  return allowed.includes(normalized) ? normalized : DEFAULT_SCAN_SETTINGS.model;
}

function formatModelLabel(model) {
  return MODEL_LABELS[model] || model || "AI";
}

function buildPrompt(policyText, task, settings = DEFAULT_SCAN_SETTINGS) {
  const trimmed = truncateWords(policyText, settings.mode === "deep" ? 140 : 100);
  if (task.resultKey === "summary") {
    return `Answer one question about this privacy policy excerpt.
Question: ${task.question}
Return only JSON like {"summary":"This policy collects email and device data, shares data with service providers, and uses cookies."}
Keep it factual and under 45 words. Do not invent facts.
Policy:
${trimmed}`;
  }

  if (task.resultKey === "privacy_score") {
    return `Answer one question about this privacy policy excerpt.
Question: ${task.question}
Return only JSON like {"privacy_score":72,"risk_level":"MEDIUM","user_warning":"Data is shared with advertising partners."}
Use risk_level from: LOW, MEDIUM, HIGH, CRITICAL. If no warning, use an empty string.
Keep it factual and concise. Do not invent facts.
Policy:
${trimmed}`;
  }

  return `Answer one question about this privacy policy excerpt.
Question: ${task.question}
Allowed answers: ${task.allowedKeys.join(", ")}
Return only JSON like {"items":["email"]}. Use {"items":[]} if none are clearly present.
Do not explain. Do not invent facts.
Policy:
${trimmed}`;
}

async function analyzePolicy(policyText, trackerSignals, log, settings = DEFAULT_SCAN_SETTINGS, scanState) {
  const chunkWords = settings.mode === "deep" ? 140 : 100;
  const chunks = chunkTextByWords(policyText, chunkWords).slice(0, settings.chunkLimit);
  const reports = [];
  const jobs = buildAiQuestionJobs(chunks);

  for (let index = 0; index < jobs.length; index += 1) {
    throwIfCancelled(scanState);
    const job = jobs[index];
    const progress = 65 + Math.round(((index + 1) / jobs.length) * 10);

    reports.push(await analyzeQuestion(job, trackerSignals, log, index, jobs.length, progress, settings, scanState));
  }

  log("[AI] Policy chunks merged", 76);
  return mergeReports(reports, trackerSignals, policyText);
}

function buildAiQuestionJobs(chunks) {
  const jobs = [];
  chunks.forEach((chunk, chunkIndex) => {
    AI_TASKS.forEach((task) => {
      jobs.push({
        chunk,
        chunkIndex,
        task
      });
    });
  });
  jobs.push({
    chunk: chunks.join(" "),
    chunkIndex: chunks.length,
    task: SUMMARY_TASK
  });
  return jobs;
}

async function analyzeQuestion(job, trackerSignals, log, jobIndex, jobCount, progress, settings, scanState) {
  const partial = createEmptyAiReport();
  const label = buildQuestionLogLabel(job);

  const modelLabel = formatModelLabel(settings.model);

  try {
    throwIfCancelled(scanState);
    log(`[AI] Question ${jobIndex + 1}/${jobCount}: ${label}`, progress);
    const prompt = buildPrompt(job.chunk, job.task, settings);
    const aiResponse = await callOllama(prompt, settings, scanState);
    throwIfCancelled(scanState);
    if (job.task.resultKey === "summary") {
      partial.summary = normalizeTaskSummary(aiResponse);
      return partial;
    }
    if (job.task.resultKey === "privacy_score") {
      const scorePayload = normalizeTaskScore(aiResponse);
      partial.privacy_score = scorePayload.privacy_score;
      partial.risk_level = scorePayload.risk_level;
      partial.user_warning = scorePayload.user_warning;
      return partial;
    }
    const items = normalizeTaskItems(aiResponse, job.task.allowedKeys);
    applyTaskItems(partial, job.task.resultKey, items);
  } catch (error) {
    log(`[AI] Question ${jobIndex + 1} failed; using local fallback`, progress);
    return buildLocalReport(job.chunk, trackerSignals, error);
  }

  partial.summary = "";
  return partial;
}

function buildQuestionLogLabel(job) {
  if (job.task.resultKey === "summary") {
    return "Overall Summary";
  }

  return `Section ${job.chunkIndex + 1} ${formatAiTaskLabel(job.task.resultKey)}`;
}

function formatAiTaskLabel(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

async function callOllama(prompt, settings = DEFAULT_SCAN_SETTINGS, scanState) {
  const controller = new AbortController();
  scanState?.controllers.add(controller);
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  const modelLabel = formatModelLabel(settings.model);
  const body = {
    model: settings.model,
    prompt,
    stream: false,
    format: "json",
    options: {
      num_ctx: 2048,
      temperature: 0.1,
      num_predict: settings.mode === "deep" ? 120 : 80
    }
  };

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const details = await response.text();
      if (response.status === 404) {
        const err = new Error("Ollama is not running or endpoint is missing");
        err.hint = "Start Ollama: ollama serve";
        throw err;
      }
      if (response.status === 403) {
        const err = new Error("Ollama blocked the Chrome extension request");
        err.hint =
          "Restart Ollama with OLLAMA_ORIGINS=chrome-extension://* so extensions are allowed";
        throw err;
      }
      const err = new Error(`Ollama request failed (${response.status})`);
      err.hint = details || "Try a smaller policy page or restart Ollama";
      throw err;
    }

    const data = await response.json();
    if (!data.response) {
      throw new Error(`${modelLabel} returned an empty response`);
    }

    return data.response;
  } catch (error) {
    if (error?.name === "AbortError") {
      const err = new Error(`${modelLabel} took too long`);
      err.hint = "Using local privacy analysis instead";
      throw err;
    }
    if (String(error?.message || "").includes("fetch")) {
      const err = new Error("Cannot reach Ollama at localhost:11434");
      err.hint = "Make sure Ollama is running and the model is installed";
      throw err;
    }
    if (String(error?.message || "").includes("model")) {
      const err = new Error(`${modelLabel} model not found`);
      err.hint = `Run: ollama pull ${settings.model}`;
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    scanState?.controllers.delete(controller);
  }
}

function cancelScan(requestId) {
  const scanState = activeScans.get(requestId);
  if (!scanState) return;
  scanState.cancelled = true;
  scanState.controllers.forEach((controller) => controller.abort());
}

function throwIfCancelled(scanState) {
  if (scanState?.cancelled) {
    const err = new Error("Scan cancelled");
    err.hint = "You stopped the scan before it finished";
    throw err;
  }
}

function normalizeAiReport(rawText) {
  const json = extractJsonObject(rawText);
  if (!json) {
    const err = new Error("Invalid AI JSON response");
    err.hint = "Try scanning again or increase policy text length";
    throw err;
  }

  const parsed = JSON.parse(json);
  const report = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
  const normalized = {
    summary: report.summary || "",
    privacy_score: clamp(Number(report.privacy_score || 0), 0, 100),
    risk_level: report.risk_level || "UNKNOWN",
    user_warning: report.user_warning || "",
    red_flags: normalizeSignalGroup(report.red_flags, DEFAULT_RED_FLAGS),
    trackers: normalizeTrackerMap(report.trackers, DEFAULT_TRACKERS),
    data_collected: normalizeSignalGroup(report.data_collected, DEFAULT_DATA_COLLECTED),
    permission_signals: normalizeSignalGroup(report.permission_signals, DEFAULT_PERMISSIONS),
    deploy_log: Array.isArray(report.deploy_log)
      ? report.deploy_log
      : [
          "[SCAN] Searching website pages...",
          "[AI] Running model analysis...",
          "[DONE] Scan completed successfully"
        ]
  };

  return normalized;
}

function createEmptyAiReport() {
  return {
    summary: "",
    privacy_score: 75,
    risk_level: "UNKNOWN",
    user_warning: "",
    red_flags: normalizeKeyList([], DEFAULT_RED_FLAGS),
    trackers: normalizeTrackerMap([], DEFAULT_TRACKERS),
    data_collected: normalizeKeyList([], DEFAULT_DATA_COLLECTED),
    permission_signals: normalizeKeyList([], DEFAULT_PERMISSIONS),
    deploy_log: [
      "[AI] Asked focused privacy questions",
      "[DONE] Chunk analysis completed"
    ]
  };
}

function normalizeTaskItems(rawText, allowedKeys) {
  const json = extractJsonObject(rawText);
  if (!json) {
    throw new Error("Invalid AI JSON response");
  }

  const parsed = JSON.parse(json);
  const source = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
  const items = Array.isArray(source.items) ? source.items : [];
  const allowed = new Set(allowedKeys);

  return items
    .map(normalizeKeyName)
    .filter((key) => allowed.has(key));
}

function normalizeTaskSummary(rawText) {
  const json = extractJsonObject(rawText);
  if (!json) {
    throw new Error("Invalid AI JSON response");
  }

  const parsed = JSON.parse(json);
  const source = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
  const summary = cleanText(source.summary || "");
  if (!summary) {
    throw new Error("AI returned an empty summary");
  }
  return truncate(summary, 260);
}

function normalizeTaskScore(rawText) {
  const json = extractJsonObject(rawText);
  if (!json) {
    throw new Error("Invalid AI JSON response");
  }

  const parsed = JSON.parse(json);
  const source = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
  const score = clamp(Number(source.privacy_score || 0), 0, 100);
  const level = String(source.risk_level || "UNKNOWN").toUpperCase();
  const allowedLevels = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"]);
  const riskLevel = allowedLevels.has(level) ? level : "UNKNOWN";
  const userWarning = truncate(cleanText(source.user_warning || ""), 160);

  return {
    privacy_score: score,
    risk_level: riskLevel,
    user_warning: userWarning
  };
}

function applyTaskItems(report, resultKey, items) {
  const defaultsByKey = {
    red_flags: DEFAULT_RED_FLAGS,
    trackers: DEFAULT_TRACKERS,
    data_collected: DEFAULT_DATA_COLLECTED,
    permission_signals: DEFAULT_PERMISSIONS
  };
  const defaults = defaultsByKey[resultKey];
  if (!defaults) return;

  if (resultKey === "trackers") {
    report.trackers = normalizeTrackerMap(items, DEFAULT_TRACKERS);
    return;
  }

  report[resultKey] = normalizeKeyList(items, defaults);
}

function chunkTextByWords(text, maxWords) {
  const words = cleanText(text).split(/\s+/).filter(Boolean);
  const chunks = [];

  for (let index = 0; index < words.length; index += maxWords) {
    chunks.push(words.slice(index, index + maxWords).join(" "));
  }

  return chunks.length ? chunks : [truncateWords(text, maxWords)];
}

function truncateWords(text, maxWords) {
  return cleanText(text).split(/\s+/).filter(Boolean).slice(0, maxWords).join(" ");
}

function mergeReports(reports, trackerSignals, policyText = "") {
  const validReports = reports.filter(Boolean);
  if (!validReports.length) {
    return buildLocalReport("", trackerSignals, new Error("No analysis available"));
  }
  const localReport = buildLocalReport(policyText, trackerSignals);
  const mergedReports = [...validReports, localReport];

  const mergedRedFlags = mergeBoolMaps(
    mergedReports.map((report) => report.red_flags),
    DEFAULT_RED_FLAGS
  );
  const mergedTrackers = mergeTrackerMaps(
    mergedReports.map((report) => report.trackers),
    trackerSignals
  );
  const mergedDataCollected = mergeBoolMaps(
    mergedReports.map((report) => report.data_collected),
    DEFAULT_DATA_COLLECTED
  );
  const mergedPermissions = mergeBoolMaps(
    mergedReports.map((report) => report.permission_signals),
    DEFAULT_PERMISSIONS
  );

  const baseScore = resolveAiScore(validReports, localReport);
  const { highRiskCount, attentionCount, normalCount } = countRiskGroups(
    mergedRedFlags,
    mergedDataCollected,
    mergedPermissions
  );
  const score = clamp(
    baseScore - highRiskCount * 3 - attentionCount * 2 - normalCount * 1,
    0,
    100
  );
  const riskLevel = chooseRiskLevel(
    mergedReports.map((report) => report.risk_level),
    score
  );

  return {
    summary: buildMergedSummary(validReports, localReport),
    privacy_score: score,
    risk_level: riskLevel,
    user_warning: validReports.map((report) => report.user_warning).filter(Boolean).join(" "),
    red_flags: mergedRedFlags,
    trackers: mergedTrackers,
    data_collected: mergedDataCollected,
    permission_signals: mergedPermissions,
    deploy_log: [
      "[SCAN] Searching website pages...",
      "[FOUND] Privacy Policy detected",
      `[AI] Answered ${validReports.length} focused privacy question${validReports.length === 1 ? "" : "s"}`,
      "[DONE] Scan completed successfully"
    ]
  };
}

function resolveAiScore(reports, fallbackReport) {
  const scores = reports
    .map((report) => Number(report?.privacy_score))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!scores.length) {
    return clamp(Number(fallbackReport?.privacy_score || 0), 0, 100);
  }

  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return clamp(Math.round(average), 0, 100);
}

function countRiskGroups(redFlags, dataCollected, permissionSignals) {
  const highRiskFlagKeys = [
    "data_selling",
    "biometric_data",
    "sensitive_data",
    "children_data",
    "indefinite_retention",
    "weak_deletion_rights"
  ];
  const highRiskDataKeys = [
    "biometric_data",
    "health_data",
    "location_data",
    "card_information"
  ];

  const trueFlags = getTrueKeys(redFlags);
  const trueData = getTrueKeys(dataCollected);
  const truePermissions = getTrueKeys(permissionSignals);

  const highRiskCount = trueFlags.filter((key) => highRiskFlagKeys.includes(key)).length;
  const attentionCount = trueFlags.filter((key) => !highRiskFlagKeys.includes(key)).length;
  const normalDataCount = trueData.filter((key) => !highRiskDataKeys.includes(key)).length;

  return {
    highRiskCount,
    attentionCount,
    normalCount: normalDataCount + truePermissions.length
  };
}

function getTrueKeys(map) {
  return Object.keys(map || {}).filter(
    (key) => String(map[key] || "").toUpperCase() === "TRUE"
  );
}

function mergeBoolMaps(maps, defaults) {
  const result = { ...defaults };
  Object.keys(result).forEach((key) => {
    const values = maps.map((map) => String(map?.[key] || "UNKNOWN").toUpperCase());
    if (values.includes("TRUE")) {
      result[key] = "TRUE";
    } else if (values.includes("FALSE")) {
      result[key] = "FALSE";
    } else {
      result[key] = "UNKNOWN";
    }
  });
  return result;
}

function mergeTrackerMaps(maps, trackerSignals) {
  const merged = mergeBoolMaps(maps, DEFAULT_TRACKERS);
  const otherTrackers = maps.flatMap((map) =>
    Array.isArray(map?.other_trackers) ? map.other_trackers : []
  );

  Object.entries(trackerSignals || {}).forEach(([key, value]) => {
    if (key === "other_trackers") return;
    if (value) merged[key] = "TRUE";
  });

  merged.other_trackers = dedupe([
    ...otherTrackers,
    ...((trackerSignals && trackerSignals.other_trackers) || [])
  ]);
  return merged;
}

function chooseRiskLevel(levels, score) {
  const rank = { UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  const highest = levels
    .map((level) => String(level || "UNKNOWN").toUpperCase())
    .sort((a, b) => (rank[b] || 0) - (rank[a] || 0))[0];

  if (highest && highest !== "UNKNOWN") return highest;
  return score >= 75 ? "LOW" : score >= 50 ? "MEDIUM" : score >= 30 ? "HIGH" : "CRITICAL";
}

function buildMergedSummary(reports, localReport) {
  const summaries = reports
    .map((report) => String(report.summary || "").trim())
    .filter(Boolean)
    .filter((summary) => !/^AI checked /i.test(summary))
    .filter((summary, index, list) => list.indexOf(summary) === index);

  if (!summaries.length) {
    const err = new Error("AI summary unavailable");
    err.hint = "Try again or ensure the model is running in Ollama";
    throw err;
  }

  return truncate(summaries.slice(0, 3).join(" "), 520);
}

function buildLocalReport(policyText, trackerSignals, error) {
  const text = String(policyText || "").toLowerCase();
  const redFlags = { ...DEFAULT_RED_FLAGS };
  const dataCollected = { ...DEFAULT_DATA_COLLECTED };
  const permissionSignals = { ...DEFAULT_PERMISSIONS };

  setSignal(redFlags, "data_selling", /sell|sale of.*data|share.*advertis/i.test(text));
  setSignal(redFlags, "third_party_sharing", /third part|partners|service providers|affiliates/i.test(text));
  setSignal(redFlags, "biometric_data", /biometric|face recognition|fingerprint/i.test(text));
  setSignal(redFlags, "location_tracking", /location|geolocation|gps/i.test(text));
  setSignal(redFlags, "indefinite_retention", /indefinite|as long as necessary|retain.*account/i.test(text));
  setSignal(redFlags, "ai_training_usage", /train.*ai|machine learning|artificial intelligence/i.test(text));
  setSignal(redFlags, "sensitive_data", /sensitive|health|financial|government id|religion/i.test(text));
  setSignal(redFlags, "behavioral_profiling", /profile|personalized ads|interest-based|behavioral/i.test(text));
  setSignal(redFlags, "dark_patterns", /automatic renewal|opt-out|prechecked/i.test(text));
  setSignal(redFlags, "cookie_manipulation", /cookie|tracking technolog/i.test(text));
  setSignal(redFlags, "children_data", /children|child|under 13|under thirteen|minor/i.test(text));
  setSignal(redFlags, "advertising_partners", /advertising partners|ad partners|marketing partners|targeted advertising|personalized advertising/i.test(text));
  setSignal(
    redFlags,
    "weak_deletion_rights",
    /retain|retention|as long as necessary/i.test(text) &&
      !/delete.*data|erasure|remove.*personal|right to deletion/i.test(text)
  );

  setSignal(dataCollected, "email", /email/i.test(text));
  setSignal(dataCollected, "phone", /phone|telephone/i.test(text));
  setSignal(dataCollected, "address", /address/i.test(text));
  setSignal(dataCollected, "payment_information", /payment|billing/i.test(text));
  setSignal(dataCollected, "card_information", /credit card|debit card|card information/i.test(text));
  setSignal(dataCollected, "location_data", /location|geolocation|gps/i.test(text));
  setSignal(dataCollected, "biometric_data", /biometric|face recognition|fingerprint/i.test(text));
  setSignal(dataCollected, "health_data", /health|medical/i.test(text));
  setSignal(dataCollected, "contacts", /contacts|address book/i.test(text));
  setSignal(dataCollected, "messages", /messages|chat/i.test(text));
  setSignal(dataCollected, "files", /files|documents/i.test(text));
  setSignal(dataCollected, "photos", /photos|images/i.test(text));
  setSignal(dataCollected, "browsing_activity", /browsing|usage data|pages visited/i.test(text));
  setSignal(dataCollected, "device_information", /device|ip address|browser|operating system/i.test(text));
  setSignal(dataCollected, "government_id", /government id|passport|driver'?s license|national id/i.test(text));

  setSignal(permissionSignals, "camera", /camera/i.test(text));
  setSignal(permissionSignals, "microphone", /microphone/i.test(text));
  setSignal(permissionSignals, "location", /location|geolocation|gps/i.test(text));
  setSignal(permissionSignals, "contacts", /contacts|address book/i.test(text));
  setSignal(permissionSignals, "notifications", /notifications/i.test(text));
  setSignal(permissionSignals, "bluetooth", /bluetooth/i.test(text));
  setSignal(permissionSignals, "calendar", /calendar/i.test(text));

  const trueFlags = Object.values(redFlags).filter((value) => value === "TRUE").length;
  const trueData = Object.values(dataCollected).filter((value) => value === "TRUE").length;
  const trackerCount = Object.entries(trackerSignals || {}).filter(
    ([key, value]) => key !== "other_trackers" && value
  ).length + (trackerSignals?.other_trackers || []).length;
  const score = clamp(88 - trueFlags * 7 - trueData * 2 - trackerCount * 5, 20, 92);
  const riskLevel = score >= 75 ? "LOW" : score >= 50 ? "MEDIUM" : score >= 30 ? "HIGH" : "CRITICAL";

  return {
    summary: buildLocalSummary(redFlags, dataCollected, permissionSignals, trackerCount),
    privacy_score: score,
    risk_level: riskLevel,
    user_warning: error?.message || "",
    red_flags: redFlags,
    trackers: { ...DEFAULT_TRACKERS },
    data_collected: dataCollected,
    permission_signals: permissionSignals,
    deploy_log: [
      "[SCAN] Searching website pages...",
      "[FOUND] Privacy Policy detected",
      "[AI] Model unavailable; local analysis used",
      "[DONE] Scan completed successfully"
    ]
  };
}

function buildLocalSummary(redFlags, dataCollected, permissionSignals, trackerCount) {
  const dataItems = getTrueSignalLabels(dataCollected).slice(0, 4);
  const riskItems = getTrueSignalLabels(redFlags).slice(0, 3);
  const permissionItems = getTrueSignalLabels(permissionSignals).slice(0, 2);
  const parts = [];

  if (dataItems.length) {
    parts.push(`Detected data collection: ${dataItems.join(", ")}.`);
  }
  if (riskItems.length) {
    parts.push(`Potential privacy risks: ${riskItems.join(", ")}.`);
  }
  if (permissionItems.length) {
    parts.push(`Permission signals: ${permissionItems.join(", ")}.`);
  }
  if (trackerCount > 0) {
    parts.push(`${trackerCount} tracker signal${trackerCount === 1 ? "" : "s"} detected.`);
  }

  return parts.length
    ? parts.join(" ")
    : "The policy was scanned, but only limited privacy signals were detected.";
}

function getTrueSignalLabels(map) {
  return Object.keys(map || {})
    .filter((key) => map[key] === "TRUE")
    .map((key) => key.replace(/_/g, " "));
}

function setSignal(target, key, detected) {
  target[key] = detected ? "TRUE" : "FALSE";
}

function normalizeSignalGroup(value, defaults) {
  if (Array.isArray(value)) {
    return normalizeKeyList(value, defaults);
  }
  return normalizeBoolMap(value, defaults);
}

function normalizeKeyList(keys, defaults) {
  const result = {};
  Object.keys(defaults).forEach((key) => {
    result[key] = "FALSE";
  });

  keys.forEach((key) => {
    const normalizedKey = normalizeKeyName(key);
    if (normalizedKey in result) {
      result[normalizedKey] = "TRUE";
    }
  });

  return result;
}

function normalizeKeyName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\w]/g, "");
}

function normalizeBoolMap(map, defaults) {
  const result = { ...defaults };
  const source = map || {};
  Object.keys(result).forEach((key) => {
    if (!(key in source)) return;
    const value = String(source[key] || "UNKNOWN").toUpperCase();
    result[key] = value === "TRUE" ? "TRUE" : value === "FALSE" ? "FALSE" : "UNKNOWN";
  });
  return result;
}

function normalizeTrackerMap(map, defaults) {
  if (Array.isArray(map)) {
    const base = normalizeKeyList(map, defaults);
    base.other_trackers = map
      .map(normalizeKeyName)
      .filter((key) => key && !(key in defaults));
    return base;
  }

  const base = normalizeBoolMap(map, defaults);
  base.other_trackers = Array.isArray(map?.other_trackers) ? map.other_trackers : [];
  return base;
}

function detectTrackers(scriptSources, inlineScripts, policyHtml) {
  const signals = {
    google_analytics: false,
    google_tag_manager: false,
    meta_pixel: false,
    tiktok_pixel: false,
    twitter_pixel: false,
    linkedin_insight: false,
    hotjar: false,
    other_trackers: []
  };

  const sources = [...(scriptSources || [])];
  const inline = (inlineScripts || []).join(" ");
  const corpus = [policyHtml || "", inline, sources.join(" ")].join(" ");

  const rules = [
    { key: "google_analytics", regex: /google-analytics.com|gtag\(|ga\('create'|analytics.js/i },
    { key: "google_tag_manager", regex: /googletagmanager.com|gtm.js/i },
    { key: "meta_pixel", regex: /connect.facebook.net|facebook.com\/tr|fbq\(/i },
    { key: "tiktok_pixel", regex: /tiktok.com\/pixel|ttq\(/i },
    { key: "twitter_pixel", regex: /twitter.com\/i\/adsct|twq\(/i },
    { key: "linkedin_insight", regex: /snap.licdn.com|linkedin.com\/li\/collect/i },
    { key: "hotjar", regex: /hotjar.com|hj\(/i }
  ];

  rules.forEach((rule) => {
    if (rule.regex.test(corpus)) {
      signals[rule.key] = true;
    }
  });

  const knownDomains = [
    "google-analytics.com",
    "googletagmanager.com",
    "facebook.net",
    "tiktok.com",
    "twitter.com",
    "licdn.com",
    "hotjar.com"
  ];

  sources.forEach((src) => {
    if (!src) return;
    try {
      const url = new URL(src);
      const domain = url.hostname;
      if (
        /analytics|pixel|tracker|collect|insight/i.test(domain) &&
        !knownDomains.some((known) => domain.includes(known))
      ) {
        signals.other_trackers.push(domain);
      }
    } catch {
      return;
    }
  });

  signals.other_trackers = dedupe(signals.other_trackers);
  return signals;
}
