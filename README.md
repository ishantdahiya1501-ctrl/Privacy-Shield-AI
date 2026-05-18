# Privacy Shield AI

> Your AI Privacy Firewall

Privacy Shield AI is a local-first AI-powered Chrome extension that analyzes website privacy policies in real time and warns users about dangerous data practices before they sign up, log in, or share personal information online.

Unlike traditional cloud-based AI tools, Privacy Shield AI performs analysis locally using Ollama and lightweight local LLMs, ensuring better privacy, offline capability, and faster user trust.

---

## 🚀 Features

- 🔍 AI-powered privacy policy analysis
- 🛡️ Privacy risk scoring system
- ⚠️ Real-time signup and login warnings
- 🧠 “Truth Translator” for legal jargon
- 📡 Tracker detection
- 🚨 Dangerous clause detection
- 🧾 Simple human-readable summaries
- 🔒 Local-first AI processing
- 🌐 Chrome Extension support
- 📊 Privacy dashboard and analytics
- 🎯 Cybersecurity-inspired modern UI

---

## 💡 Inspiration

Millions of users blindly accept privacy policies every day without understanding how their personal data is collected, shared, or sold. Privacy Shield AI was created to make online privacy understandable, transparent, and accessible to everyone through local AI-powered analysis.

---

## 🛠️ How It Works

1. Detects privacy policy pages automatically
2. Extracts and cleans policy text from the website
3. Runs a local rule-engine analysis
4. Sends relevant sections to a local LLM using Ollama
5. Detects privacy risks, trackers, and dangerous clauses
6. Translates complex legal text into simple explanations
7. Displays privacy scores and real-time warnings

---

## 🧠 Local AI Architecture

```txt
Chrome Extension
       ↓
Local Backend Server
       ↓
Ollama
       ↓
Local LLM
```

Privacy Shield AI uses a local-first architecture to ensure that user data and analyzed privacy policies are never sent to external AI servers.

---

## ⚡ Tech Stack

### Frontend
- React
- Tailwind CSS
- HTML5
- CSS3
- JavaScript

### Extension
- Chrome Extension Manifest V3
- Content Scripts
- Background Scripts

### Backend
- Node.js
- Express.js

### AI
- Ollama
- Gemma
- Phi
- TinyLlama

### Tools
- VS Code
- Git & GitHub
- Chrome Developer Tools

---

## 🔍 Privacy Risk Analysis

The extension uses a hybrid system:
- Rule-based privacy detection
- Local LLM explanation engine

Example detections:
- Third-party data sharing
- Data selling
- AI training usage
- Location tracking
- Biometric collection
- Infinite data retention
- Hidden trackers

---

## 🧩 Example Output

```json
{
  "summary": "This website collects user location and shares data with advertisers.",
  "privacy_score": 42,
  "danger_level": "Risky",
  "red_flags": [
    "Third-party sharing",
    "Location tracking",
    "Advertising data usage"
  ],
  "recommendation": "Avoid sharing sensitive personal information."
}
```

---

## 🎨 UI & Design

Privacy Shield AI features:
- Dark futuristic UI
- Cybersecurity-inspired design
- Glassmorphism effects
- Animated warning indicators
- Smooth transitions
- Modern dashboard experience

---

## ⚔️ Challenges We Ran Into

- Extracting clean text from differently structured websites
- Optimizing local LLM performance for large privacy policies
- Reducing false positives in risk detection
- Detecting trackers consistently across websites
- Managing extension-to-local-backend communication
- Handling real-time analysis without slowing browsing experience

---

## 🏆 Accomplishments

- Built a fully functional local-first AI privacy analysis system
- Integrated Chrome extensions with local LLMs through Ollama
- Created a custom privacy scoring engine
- Developed a legal-language “Truth Translator”
- Designed a polished cybersecurity-inspired UI
- Achieved real-time privacy warnings directly in the browser

---

## 📚 What We Learned

Through building Privacy Shield AI, we learned:
- Chrome Extension Manifest V3 development
- Local AI model integration
- DOM scraping and parsing
- Real-time browser security analysis
- Local inference optimization
- Cybersecurity-focused UI/UX design
- Privacy risks used across the modern web

---

## 🔮 Future Plans

We plan to:
- Open source the project
- Release a polished free public version
- Improve AI accuracy and speed
- Add support for more browsers
- Expand tracker and dark pattern detection
- Build a larger privacy-focused developer community

---

## 📸 Screenshots

> Add screenshots here

### Extension Popup
```md
![Popup Screenshot](./screenshots/popup.png)
```

### Risk Warning
```md
![Warning Screenshot](./screenshots/warning.png)
```

### Dashboard
```md
![Dashboard Screenshot](./screenshots/dashboard.png)
```

---

## ⚙️ Installation

### Clone Repository

```bash
git clone https://github.com/ishantdahiya1501-ctrl/Privacy-Shield-AI.git
```

### Navigate to Project

```bash
cd Privacy-Shield-AI
```

### Install Dependencies

```bash
npm install
```

### Install Ollama

Download:
https://ollama.com/download

Run a model:

```bash
ollama run gemma3:4b
```

### Start Backend

```bash
npm run server
```

### Start Frontend

```bash
npm run dev
```

### Load Extension

1. Open Chrome
2. Go to:
```txt
chrome://extensions
```
3. Enable Developer Mode
4. Click “Load Unpacked”
5. Select the extension folder

---

## 🤝 Contributing

Contributions are welcome.

If you'd like to improve Privacy Shield AI:
- Fork the repository
- Create a feature branch
- Submit a pull request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🌐 GitHub Repository

GitHub:
https://github.com/ishantdahiya1501-ctrl/Privacy-Shield-AI

---

## 👨‍💻 Developer

Developed by Ishant Dahiya

---

## ⭐ Final Vision

Privacy Shield AI aims to make privacy understandable and accessible for everyone by turning complex legal privacy policies into simple, actionable insights using local AI technology.
