export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

export function truncate(text, maxLength) {
  const safe = String(text || "");
  if (safe.length <= maxLength) return safe;
  return `${safe.slice(0, maxLength)}...`;
}

export function dedupe(list) {
  return Array.from(new Set(list));
}

export function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function extractJsonObject(text) {
  if (!text) return "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return "";
  return text.slice(start, end + 1);
}

export function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function getTruthyKeys(obj) {
  if (!obj) return [];
  return Object.keys(obj).filter((key) => String(obj[key]).toUpperCase() === "TRUE");
}

export function formatKeyLabel(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function joinLines(lines) {
  if (!Array.isArray(lines)) return "";
  return lines.filter(Boolean).join("\n");
}
