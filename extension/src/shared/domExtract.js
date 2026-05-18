export function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

export function extractPolicyText(doc) {
  const main = doc.querySelector("main") || doc.querySelector("article") || doc.querySelector("#privacy") || doc.body;
  return cleanText(main.innerText || "").slice(0, 12000);
}

export function isPrivacyPolicyPage(url, doc) {
  const haystack = `${url} ${doc.title}`.toLowerCase();
  return haystack.includes("privacy") || haystack.includes("policy");
}

export function findPolicyLinks(doc) {
  return Array.from(doc.querySelectorAll("a"))
    .filter((link) => link.textContent && link.textContent.toLowerCase().includes("privacy"))
    .slice(0, 6)
    .map((link) => link.href);
}
