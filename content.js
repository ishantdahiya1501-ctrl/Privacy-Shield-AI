chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "GET_POLICY_LINKS") return;

  const links = Array.from(document.querySelectorAll("a[href]"))
    .map((link) => ({
      href: link.href,
      text: link.textContent || "",
      aria: link.getAttribute("aria-label") || ""
    }))
    .filter((link) => link.href && /^https?:/i.test(link.href));

  const scriptSources = Array.from(document.scripts)
    .map((script) => script.src)
    .filter((src) => src);

  const inlineScripts = Array.from(document.scripts)
    .map((script) => script.textContent || "")
    .filter((text) => text.length > 0)
    .slice(0, 10)
    .map((text) => text.slice(0, 300));

  const pageText = document.body ? document.body.innerText : "";
  const lowered = `${document.title} ${pageText.slice(0, 600)}`.toLowerCase();
  const isPrivacyPage = /privacy policy|privacy notice|data protection/i.test(
    lowered
  );

  const policyText = isPrivacyPage ? cleanText(pageText) : "";

  sendResponse({
    links,
    scriptSources,
    inlineScripts,
    isPrivacyPage,
    policyText
  });
});

function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim()
    .slice(0, 12000);
}
