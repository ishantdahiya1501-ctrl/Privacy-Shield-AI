# Privacy Shield AI

Local AI privacy policy scanner that builds a clear risk dashboard for the current website. The extension runs an LLM on your machine (via Ollama) and combines AI findings with local tracker detection.

## Features
- AI summary, privacy score, risk level, and warnings
- Red flags, data collected, permission signals, and tracker detection
- Risk grouping (High Risk, Needs Attention, Normal Data)
- Scan timeline and recent scan history
- Export report JSON and copy summary
- Model selection (TinyLlama, Gemma 4, Qwen2.5 0.5B)
- Fast/Deep scan modes and chunk limit control

## How It Works
1. The content script gathers policy links, scripts, and page text.
2. The background worker finds the policy page and extracts text.
3. Local tracker detection runs on scripts and HTML.
4. The LLM answers focused questions and produces a summary and score.
5. AI and local signals are merged and rendered in the popup.

## Requirements
- Chrome (MV3 compatible)
- Ollama running locally on http://localhost:11434
- One of the supported models pulled in Ollama

## Setup
1. Install Ollama:
   - Download: https://ollama.com/download
2. Start the Ollama server:
   - `ollama serve`
3. Allow Chrome extensions to reach Ollama (if blocked):
   - `setx OLLAMA_ORIGINS "chrome-extension://*"`
   - Restart Ollama after setting the variable
4. Pull at least one model:
   - `ollama pull tinyllama`
   - `ollama pull gemma4`
   - `ollama pull qwen2.5:0.5b`
5. Load the extension in Chrome:
   - Open `chrome://extensions`
   - Enable Developer Mode
   - Click "Load unpacked" and select this folder
6. Reload the extension after any code changes:
   - Click the "Reload" button on the extension tile

## Usage
1. Open any website.
2. Click the extension icon.
3. Choose a model, mode, and chunk limit.
4. Click "Do Privacy Scan".
5. Review the AI summary, score, red flags, trackers, and tips.

## Permissions
- `activeTab`, `tabs`, `scripting`: read current tab and run content script
- `storage`: persist settings and scan history
- Host permissions:
  - `<all_urls>` to fetch policy pages
  - `http://localhost:11434/*` to call Ollama

## Troubleshooting
- "Cannot reach Ollama": make sure `ollama serve` is running.
- "Model not found": run `ollama pull <model>`.
- AI summary missing: check that the selected model is loaded and responding.

## Project Structure
- [manifest.json](manifest.json): extension config and permissions
- [background.js](background.js): scan engine, AI calls, scoring
- [content.js](content.js): page signals and policy hints
- [popup.html](popup.html): UI layout
- [popup.css](popup.css): UI styles
- [popup.js](popup.js): UI logic and rendering
- [utils/helpers.js](utils/helpers.js): shared utilities

## Notes
- The extension sends policy text only to your local Ollama instance.
- No data is sent to external servers by this extension.
