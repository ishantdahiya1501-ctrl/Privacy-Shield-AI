import { extractPolicyText, findPolicyLinks, isPrivacyPolicyPage } from "../shared/domExtract.js";
import { detectTrackers } from "../shared/trackerDetector.js";
import { detectPermissionSignals } from "../shared/permissionRisk.js";

const bannerId = "psa-warning-banner";

function injectBanner(message, tone) {
  if (document.getElementById(bannerId)) return;
  const banner = document.createElement("div");
  banner.id = bannerId;
  banner.style.cssText = `
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 2147483647;
    max-width: 320px;
    padding: 14px 16px;
    border-radius: 16px;
    background: ${tone === "danger" ? "rgba(255, 75, 75, 0.2)" : "rgba(46, 242, 255, 0.18)"};
    color: #ffffff;
    border: 1px solid rgba(255,255,255,0.2);
    backdrop-filter: blur(14px);
    font-family: system-ui, sans-serif;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  `;
  banner.innerHTML = `
    <div style="font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0.7;">Privacy Shield AI</div>
    <div style="margin-top: 6px; font-size: 14px; font-weight: 600;">${message}</div>
  `;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 12000);
}

function hasSignupForm() {
  const forms = Array.from(document.querySelectorAll("form"));
  return forms.some((form) =>
    form.querySelector("input[type='password'], input[type='email']")
  );
}

function requestAnalysis(reason) {
  const text = extractPolicyText(document);
  const trackers = detectTrackers(document);
  const permissions = detectPermissionSignals(document);
  chrome.runtime.sendMessage(
    {
      type: "PSA_ANALYZE_TEXT",
      payload: {
        text,
        url: window.location.href,
        title: document.title,
        trackers,
        permissions,
        reason
      }
    },
    (response) => {
      if (!response?.ok) return;
      if (response.result?.danger_level === "Dangerous") {
        injectBanner("High-risk privacy terms detected. Review before continuing.", "danger");
      } else if (response.result?.danger_level === "Risky") {
        injectBanner("Potential privacy risks found. Consider reviewing the policy.", "warning");
      }
    }
  );
}

function init() {
  if (isPrivacyPolicyPage(window.location.href, document)) {
    requestAnalysis("policy-page");
  } else if (hasSignupForm()) {
    injectBanner("Signup/Login detected. Running privacy scan...", "warning");
    requestAnalysis("signup-form");
  } else if (findPolicyLinks(document).length) {
    requestAnalysis("policy-link");
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PSA_REQUEST_PAGE_CONTEXT") {
    const payload = {
      text: extractPolicyText(document),
      url: window.location.href,
      title: document.title,
      trackers: detectTrackers(document),
      permissions: detectPermissionSignals(document),
      reason: "manual-scan"
    };
    sendResponse({ ok: true, payload });
    return true;
  }
  return false;
});

init();
