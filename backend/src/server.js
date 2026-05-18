import express from "express";
import cors from "cors";

const app = express();
const port = process.env.PORT || 8787;
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/ollama/health", async (req, res) => {
  try {
    const response = await fetch(`${ollamaBaseUrl}/api/tags`, { method: "GET" });
    if (!response.ok) {
      res.status(502).json({ ok: false, error: "Ollama not reachable" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(502).json({ ok: false, error: error?.message || "Ollama not reachable" });
  }
});

function buildPrompt(text, signals) {
  return `You are a privacy analyst. Summarize risks in plain English.\n` +
    `Return ONLY valid JSON with keys: summary, privacy_score, danger_level, red_flags, data_collected, third_party_sharing, data_sold, ai_training_usage, trackers_detected, recommendation.\n` +
    `Signals: ${JSON.stringify(signals || {})}\n` +
    `Policy text: ${text}`;
}

app.post("/analyze", async (req, res) => {
  const { text, model, signals } = req.body || {};
  if (!text) {
    res.status(400).json({ error: "Missing text" });
    return;
  }

  try {
    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "tinyllama",
        prompt: buildPrompt(text, signals),
        stream: false,
        format: "json"
      })
    });

    if (!response.ok) {
      res.status(502).json({ error: "Ollama error" });
      return;
    }

    const data = await response.json();
    const parsed = safeJsonParse(data.response);
    if (!parsed) {
      res.status(500).json({ error: "Invalid Ollama response" });
      return;
    }

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error?.message || "Backend failure" });
  }
});

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

app.listen(port, () => {
  console.log(`Privacy Shield AI backend running on ${port}`);
});
