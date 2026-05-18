import React, { useEffect, useMemo, useState } from "react";

const dangerTone = {
  Safe: "from-safe/30 to-safe/5 text-safe border-safe/40",
  Moderate: "from-warning/30 to-warning/5 text-warning border-warning/40",
  Risky: "from-ember/40 to-ember/5 text-ember border-ember/40",
  Dangerous: "from-ember/70 to-ember/20 text-ember border-ember/70"
};

const emptyState = {
  summary: "No scan yet. Open a privacy policy page or run a quick scan.",
  privacy_score: 100,
  danger_level: "Safe",
  red_flags: [],
  data_collected: [],
  third_party_sharing: false,
  data_sold: false,
  ai_training_usage: false,
  trackers_detected: [],
  recommendation: "Run a scan to see insights."
};

export default function App() {
  const [latest, setLatest] = useState(emptyState);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState([]);
  const [votes, setVotes] = useState({ up: 0, down: 0 });
  const [llmStatus, setLlmStatus] = useState("checking");
  const [lastError, setLastError] = useState("");
  const [scanSteps, setScanSteps] = useState([]);
  const [scanSeconds, setScanSeconds] = useState(0);

  useEffect(() => {
    chrome.storage.local.get(["psa_latest", "psa_history", "psa_votes", "psa_latest_error"], (result) => {
      if (result.psa_latest) {
        setLatest(normalizeLatest(result.psa_latest));
      }
      if (Array.isArray(result.psa_history)) {
        setHistory(result.psa_history.slice(0, 5));
      }
      const domainVotes = getDomainVotes(result.psa_votes, result.psa_latest?.url);
      setVotes(domainVotes);
      if (result.psa_latest_error) {
        setLastError(result.psa_latest_error);
      }
    });

    const onChanged = (changes) => {
      if (changes.psa_latest?.newValue) {
        setLatest(normalizeLatest(changes.psa_latest.newValue));
        const domainVotes = getDomainVotes(changes.psa_votes?.newValue, changes.psa_latest.newValue?.url);
        setVotes(domainVotes);
        setProgress(100);
        setScanSteps((current) => mergeScanSteps(current, "Scan complete"));
        setTimeout(() => setStatus("idle"), 250);
      }
      if (changes.psa_history?.newValue) {
        setHistory(changes.psa_history.newValue.slice(0, 5));
      }
      if (changes.psa_votes?.newValue) {
        const domainVotes = getDomainVotes(changes.psa_votes.newValue, latest?.url);
        setVotes(domainVotes);
      }
      if (changes.psa_latest_error?.newValue !== undefined) {
        setLastError(changes.psa_latest_error.newValue || "");
        if (changes.psa_latest_error.newValue) {
          setProgress(100);
          setScanSteps((current) => mergeScanSteps(current, "Scan failed"));
          setTimeout(() => setStatus("idle"), 250);
        }
      }
    };

    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("http://localhost:8787/ollama/health")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setLlmStatus(data.ok ? "connected" : "offline");
      })
      .catch(() => {
        if (!active) return;
        setLlmStatus("offline");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status !== "scanning") {
      setProgress(0);
      setScanSeconds(0);
      return;
    }

    let value = 8;
    setProgress(value);
    const timer = setInterval(() => {
      value = Math.min(96, value + Math.floor(Math.random() * 9) + 4);
      setProgress(value);
    }, 280);

    const elapsedTimer = setInterval(() => {
      setScanSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(elapsedTimer);
    };
  }, [status]);

  const runScan = () => {
    setLatest(
      normalizeLatest({
        ...emptyState,
        summary: "Scanning new page...",
        privacy_score: 0,
        danger_level: "Moderate"
      })
    );
    setLastError("");
    setStatus("scanning");
    setScanSteps([]);
    const stepPlan = [
      { text: "Finding privacy policy", delay: 0 },
      { text: "Scraping page content", delay: 600 },
      { text: "Applying rule engine", delay: 1200 },
      { text: llmStatus === "connected" ? "LLM connected" : "LLM offline", delay: 1800 },
      { text: "Sending scan request", delay: 2400 }
    ];
    stepPlan.forEach((step) => {
      setTimeout(() => {
        setScanSteps((current) => mergeScanSteps(current, step.text));
      }, step.delay);
    });
    if (!chrome?.runtime?.sendMessage) {
      setLastError("Extension runtime not available.");
      setStatus("idle");
      return;
    }
    chrome.runtime.sendMessage({ type: "PSA_SCAN_ACTIVE_TAB" }, () => {
      if (chrome.runtime.lastError) {
        setLastError(chrome.runtime.lastError.message || "Scan failed.");
        setProgress(100);
        setScanSteps((current) => mergeScanSteps(current, "Scan failed"));
        setStatus("idle");
        return;
      }
      setTimeout(() => {
        setProgress(100);
        setScanSteps((current) => mergeScanSteps(current, "Scan complete"));
        setTimeout(() => setStatus("idle"), 250);
      }, 800);
    });

  };

  const handleVote = (direction) => {
    const url = latest.url || "";
    chrome.storage.local.get(["psa_votes"], (result) => {
      const votesMap = result.psa_votes || {};
      const key = getDomain(url);
      const current = votesMap[key] || { up: 0, down: 0 };
      const next = {
        up: current.up + (direction === "up" ? 1 : 0),
        down: current.down + (direction === "down" ? 1 : 0)
      };
      votesMap[key] = next;
      chrome.storage.local.set({ psa_votes: votesMap });
      setVotes(next);
    });
  };

  const levelTone = useMemo(() => dangerTone[latest.danger_level] || dangerTone.Safe, [latest.danger_level]);
  const domainLabel = useMemo(() => getDomain(latest.url), [latest.url]);
  const backgroundTone = useMemo(() => getBackgroundTone(latest.privacy_score), [latest.privacy_score]);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${backgroundTone} px-4 py-6`}>
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glass backdrop-blur-glass">
        <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(circle_at_top,_rgba(46,242,255,0.18),_transparent_55%)]"></div>
        <div className="absolute -top-24 right-0 h-48 w-48 rounded-full bg-ember/20 blur-3xl"></div>
        <div className="relative z-10 space-y-5">
          {lastError ? (
            <section className="rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-xs text-ember">
              <div className="uppercase tracking-[0.3em]">Previous scan interrupted</div>
              <div className="mt-2 text-[11px] text-white/70">{lastError}</div>
            </section>
          ) : null}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <img src="/logo.svg" alt="Privacy Shield AI logo" className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Privacy Shield AI</p>
                <h1 className="text-2xl font-semibold">Privacy Firewall</h1>
              </div>
            </div>
            <button
              onClick={runScan}
              className="rounded-full border border-neon/40 bg-neon/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-neon transition hover:bg-neon/20"
            >
              {status === "scanning" ? "Scanning..." : "Quick Scan"}
            </button>
          </header>

          {status === "scanning" ? (
            <div className="rounded-2xl border border-neon/30 bg-neon/10 px-4 py-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-neon/80">
                <span>Scanning</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-white/60">
                <span>Elapsed</span>
                <span>{formatElapsed(scanSeconds)}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neon to-ember transition-all"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="mt-3 space-y-1 text-[11px] text-white/70">
                {scanSteps.length ? (
                  scanSteps.map((step, index) => <div key={`step-${index}`}>{step}</div>)
                ) : (
                  <div>Initializing scan...</div>
                )}
              </div>
            </div>
          ) : null}

          {lastError ? (
            <section className="rounded-2xl border border-ember/40 bg-ember/10 px-4 py-3 text-xs text-ember">
              <div className="uppercase tracking-[0.3em]">Last Error</div>
              <div className="mt-2 text-[11px] text-white/70">{lastError}</div>
            </section>
          ) : null}

          <section className={`rounded-2xl border bg-gradient-to-br p-4 ${levelTone}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em]">Privacy Score</p>
                <div className="text-4xl font-bold">{latest.privacy_score}</div>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.3em]">Danger Level</p>
                <div className="text-lg font-semibold">{latest.danger_level}</div>
              </div>
            </div>
            <div className="mt-3 text-sm text-white/80">{latest.summary}</div>
          </section>

          <section className="grid gap-3">
            <InfoCard title="Red Flags" items={latest.red_flags} empty="No major red flags detected." />
            <InfoCard title="Trackers Detected" items={latest.trackers_detected} empty="No trackers detected on this page." />
            <InfoCard title="Data Collected" items={latest.data_collected} empty="No specific data categories found." />
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Truth Translator</p>
            <p className="mt-2 text-sm text-white/80">{latest.recommendation}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
              <Badge label={latest.third_party_sharing ? "Third-Party Sharing" : "No Third-Party Sharing"} active={latest.third_party_sharing} />
              <Badge label={latest.data_sold ? "Data Selling" : "No Data Selling"} active={latest.data_sold} />
              <Badge label={latest.ai_training_usage ? "AI Training Use" : "No AI Training"} active={latest.ai_training_usage} />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Data Flow</p>
            <div className="mt-3 flex items-center justify-between text-xs">
              <FlowNode label="You" tone="border-neon/40 text-neon" />
              <FlowLink />
              <FlowNode label={domainLabel || "Site"} tone="border-white/30 text-white/80" />
              <FlowLink />
              <FlowNode
                label={latest.third_party_sharing ? "Third Parties" : "No Sharing"}
                tone={latest.third_party_sharing ? "border-ember/50 text-ember" : "border-safe/40 text-safe"}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Community Trust</p>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-white/60">Votes for {domainLabel || "current site"}</div>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => handleVote("up")}
                  className="rounded-full border border-safe/40 bg-safe/10 px-3 py-1 text-safe"
                >
                  Up {votes.up}
                </button>
                <button
                  onClick={() => handleVote("down")}
                  className="rounded-full border border-ember/40 bg-ember/10 px-3 py-1 text-ember"
                >
                  Down {votes.down}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Privacy Timeline</p>
            <ul className="mt-3 max-h-36 space-y-2 overflow-y-auto pr-1 text-xs text-white/70">
              {history.length ? (
                history.map((entry, index) => (
                  <li key={`history-${index}`} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <span className="truncate">{getDomain(entry.url) || "Site"}</span>
                    <span className="text-white/50">{formatTimestamp(entry.scanned_at)}</span>
                    <span className="font-semibold text-white">{entry.privacy_score}</span>
                  </li>
                ))
              ) : (
                <li className="text-white/50">No scans yet. History will appear here.</li>
              )}
            </ul>
          </section>

          <footer className="space-y-2 text-center text-[11px] uppercase tracking-[0.3em] text-white/40">
            <div
              className={`rounded-full border px-3 py-2 text-[10px] ${
                llmStatus === "connected"
                  ? "border-safe/40 bg-safe/10 text-safe"
                  : llmStatus === "checking"
                  ? "border-neon/30 bg-neon/10 text-neon"
                  : "border-ember/40 bg-ember/10 text-ember"
              }`}
            >
              LLM {llmStatus === "connected" ? "connected" : llmStatus === "checking" ? "checking" : "offline"}
            </div>
            <div>Made by Ishant Dahiya</div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, items, empty }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-white/60">{title}</p>
      <ul className="mt-2 space-y-2 text-sm">
        {items?.length ? (
          items.map((item, index) => (
            <li key={`${title}-${index}`} className="rounded-xl bg-white/5 px-3 py-2 text-white/80">
              {item}
            </li>
          ))
        ) : (
          <li className="text-white/50">{empty}</li>
        )}
      </ul>
    </div>
  );
}

function Badge({ label, active }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 ${
        active ? "border-ember/60 bg-ember/15 text-ember" : "border-white/10 bg-white/5 text-white/60"
      }`}
    >
      {label}
    </span>
  );
}

function FlowNode({ label, tone }) {
  return <div className={`rounded-full border px-3 py-1 text-[11px] ${tone}`}>{label}</div>;
}

function FlowLink() {
  return <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>;
}

function getDomain(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch (error) {
    return "";
  }
}

function getDomainVotes(votesMap, url) {
  const key = getDomain(url);
  if (!votesMap || !key) return { up: 0, down: 0 };
  return votesMap[key] || { up: 0, down: 0 };
}

function formatTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatElapsed(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function normalizeLatest(value) {
  if (!value || typeof value !== "object") return emptyState;
  return {
    ...emptyState,
    ...value,
    summary: toText(value.summary) || emptyState.summary,
    recommendation: toText(value.recommendation) || emptyState.recommendation,
    danger_level: toText(value.danger_level) || emptyState.danger_level,
    privacy_score: toNumber(value.privacy_score, emptyState.privacy_score),
    red_flags: toArray(value.red_flags),
    data_collected: toArray(value.data_collected),
    trackers_detected: toArray(value.trackers_detected),
    third_party_sharing: Boolean(value.third_party_sharing),
    data_sold: Boolean(value.data_sold),
    ai_training_usage: Boolean(value.ai_training_usage)
  };
}

function toText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function toNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "number" || typeof item === "boolean") return String(item);
        if (item && typeof item === "object") {
          return (
            item.label ||
            item.name ||
            item.type ||
            item.category ||
            item.kind ||
            item.title ||
            safeObjectLabel(item)
          );
        }
        return String(item);
      })
      .filter(Boolean);
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    const filtered = keys.filter((key) => !isNonDataKey(key));
    if (filtered.length) return filtered;
    return [];
  }

  return [];
}

function isNonDataKey(key) {
  return [
    "ai_training_usage",
    "data_sold",
    "third_party_sharing",
    "privacy_score",
    "danger_level",
    "summary",
    "recommendation",
    "trackers_detected",
    "red_flags",
    "data_collected"
  ].includes(key);
}

function safeObjectLabel(item) {
  try {
    const keys = Object.keys(item || {});
    if (!keys.length) return "[unknown]";
    return keys.join(", ");
  } catch (error) {
    return "[unknown]";
  }
}

function mergeScanSteps(current, nextStep) {
  const safeCurrent = Array.isArray(current) ? current : [];
  if (!nextStep || safeCurrent.includes(nextStep)) return safeCurrent;
  return [...safeCurrent, nextStep];
}

function getBackgroundTone(score) {
  if (score >= 80) return "from-[#07171a] via-[#0b2a33] to-[#0b1220]";
  if (score >= 60) return "from-[#1a1607] via-[#1f2a1a] to-[#0b1220]";
  if (score >= 40) return "from-[#24110d] via-[#1b0f1f] to-[#0b1220]";
  return "from-[#2b0c0c] via-[#1f0d0d] to-[#0b1220]";
}
