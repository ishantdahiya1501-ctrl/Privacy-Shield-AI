const PERMISSION_TERMS = [
  "camera",
  "microphone",
  "location",
  "contacts",
  "notifications",
  "bluetooth",
  "calendar"
];

export function detectPermissionSignals(doc) {
  const text = (doc.body?.innerText || "").toLowerCase();
  return PERMISSION_TERMS.filter((term) => text.includes(term));
}
