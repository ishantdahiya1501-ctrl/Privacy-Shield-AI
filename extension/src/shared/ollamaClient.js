const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";
const DEFAULT_MODEL = import.meta.env.VITE_OLLAMA_MODEL || "tinyllama";

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

export async function requestOllamaSummary(payload) {
  try {
    const response = await fetch(`${DEFAULT_BACKEND_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        text: payload.text,
        signals: payload.signals
      })
    });
    if (!response.ok) throw new Error("Backend error");
    return await response.json();
  } catch (error) {
    return null;
  }
}

export async function requestOllamaDirect(prompt) {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt,
        stream: false,
        format: "json"
      })
    });
    if (!response.ok) throw new Error("Ollama error");
    const data = await response.json();
    return safeJsonParse(data.response);
  } catch (error) {
    return null;
  }
}
