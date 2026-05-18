const RULES = [
  { id: "sell-data", weight: 40, patterns: ["sell", "sold", "data sale", "sell your data"], tag: "Data selling" },
  { id: "third-party", weight: 25, patterns: ["third-party advertisers", "third party", "partners", "affiliates"], tag: "Third-party sharing" },
  { id: "biometric", weight: 30, patterns: ["biometric", "face scan", "fingerprint"], tag: "Biometric data" },
  { id: "location", weight: 20, patterns: ["precise location", "gps", "geolocation", "location tracking"], tag: "Location tracking" },
  { id: "retain", weight: 35, patterns: ["retain indefinitely", "no retention limit", "store forever"], tag: "Indefinite retention" },
  { id: "ai-training", weight: 20, patterns: ["train", "machine learning", "ai model", "improve our models"], tag: "AI training usage" },
  { id: "sensitive", weight: 18, patterns: ["health data", "medical", "financial", "ssn", "social security"], tag: "Sensitive data" },
  { id: "behavioral", weight: 16, patterns: ["behavioral advertising", "targeted ads", "profiling"], tag: "Behavioral profiling" },
  { id: "dark-patterns", weight: 15, patterns: ["dark pattern", "pre-checked", "forced consent", "opt-out only"], tag: "Dark patterns" },
  { id: "cookie-manipulation", weight: 12, patterns: ["cookie wall", "accept all", "consent wall"], tag: "Cookie manipulation" }
];

const DATA_CATEGORIES = [
  "email",
  "phone",
  "address",
  "payment",
  "card",
  "location",
  "biometric",
  "health",
  "contacts",
  "messages",
  "files",
  "photos",
  "browsing",
  "device"
];

export function runRuleEngine(text) {
  const normalized = text.toLowerCase();
  let totalRisk = 0;
  const redFlags = [];
  const excerpts = [];

  RULES.forEach((rule) => {
    rule.patterns.forEach((pattern) => {
      if (normalized.includes(pattern)) {
        totalRisk += rule.weight;
        if (!redFlags.includes(rule.tag)) redFlags.push(rule.tag);
        excerpts.push(pattern);
      }
    });
  });

  const dataCollected = DATA_CATEGORIES.filter((item) => normalized.includes(item));

  const privacyScore = Math.max(0, 100 - totalRisk);
  const dangerLevel = privacyScore >= 80 ? "Safe" : privacyScore >= 60 ? "Moderate" : privacyScore >= 40 ? "Risky" : "Dangerous";

  return {
    totalRisk,
    privacyScore,
    dangerLevel,
    redFlags,
    dataCollected,
    excerpts,
    flags: {
      thirdPartySharing: redFlags.includes("Third-party sharing"),
      dataSold: redFlags.includes("Data selling"),
      aiTrainingUsage: redFlags.includes("AI training usage")
    }
  };
}

export function extractRelevantSentences(text, maxSentences = 12) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const risky = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return RULES.some((rule) => rule.patterns.some((pattern) => lower.includes(pattern)));
  });
  return risky.slice(0, maxSentences).join(" ");
}
