const TRACKER_PATTERNS = [
  { name: "Google Analytics", match: /google-analytics|gtag\/js|analytics\.google/ },
  { name: "Google Tag Manager", match: /googletagmanager/ },
  { name: "Meta Pixel", match: /connect\.facebook\.net|fbq\(/ },
  { name: "TikTok Pixel", match: /tiktok\.com|ttq\(/ },
  { name: "Twitter Pixel", match: /static\.ads-twitter\.com|twttr/ },
  { name: "LinkedIn Insight", match: /linkedin\.com\/li/ },
  { name: "Hotjar", match: /hotjar/ }
];

export function detectTrackers(doc) {
  const scripts = Array.from(doc.querySelectorAll("script"));
  const scriptText = scripts.map((s) => s.src || s.textContent || "").join(" ");
  const found = [];
  TRACKER_PATTERNS.forEach((tracker) => {
    if (tracker.match.test(scriptText) && !found.includes(tracker.name)) {
      found.push(tracker.name);
    }
  });
  return found;
}
