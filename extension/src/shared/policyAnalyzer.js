import { EMPTY_OUTPUT } from "./types.js";
import { extractRelevantSentences, runRuleEngine } from "./ruleEngine.js";
import { requestOllamaDirect, requestOllamaSummary } from "./ollamaClient.js";

function buildFallback(ruleResult, trackers) {
  return {
    summary: "Rule-based scan completed. Review highlighted clauses.",
    privacy_score: ruleResult.privacyScore,
    danger_level: ruleResult.dangerLevel,
    red_flags: ruleResult.redFlags,
    data_collected: ruleResult.dataCollected,
    third_party_sharing: ruleResult.flags.thirdPartySharing,
    data_sold: ruleResult.flags.dataSold,
    ai_training_usage: ruleResult.flags.aiTrainingUsage,
    trackers_detected: trackers,
    recommendation: "Consider reviewing the policy details before sharing sensitive data."
  };
}

function buildPrompt(text, signals) {
  return `You are a privacy analyst. Summarize risks in plain English.\n` +
    `Return ONLY valid JSON with keys: summary, privacy_score, danger_level, red_flags, data_collected, third_party_sharing, data_sold, ai_training_usage, trackers_detected, recommendation.\n` +
    `Signals: ${JSON.stringify(signals || {})}\n` +
    `Policy text: ${text}`;
}

function mergeOutputs(ruleResult, aiOutput, trackers) {
  const base = buildFallback(ruleResult, trackers);
  if (!aiOutput) return base;

  return {
    summary: aiOutput.summary || base.summary,
    privacy_score: typeof aiOutput.privacy_score === "number" ? aiOutput.privacy_score : base.privacy_score,
    danger_level: aiOutput.danger_level || base.danger_level,
    red_flags: Array.isArray(aiOutput.red_flags) && aiOutput.red_flags.length ? aiOutput.red_flags : base.red_flags,
    data_collected: Array.isArray(aiOutput.data_collected) && aiOutput.data_collected.length ? aiOutput.data_collected : base.data_collected,
    third_party_sharing: typeof aiOutput.third_party_sharing === "boolean" ? aiOutput.third_party_sharing : base.third_party_sharing,
    data_sold: typeof aiOutput.data_sold === "boolean" ? aiOutput.data_sold : base.data_sold,
    ai_training_usage: typeof aiOutput.ai_training_usage === "boolean" ? aiOutput.ai_training_usage : base.ai_training_usage,
    trackers_detected: Array.isArray(aiOutput.trackers_detected) && aiOutput.trackers_detected.length ? aiOutput.trackers_detected : base.trackers_detected,
    recommendation: aiOutput.recommendation || base.recommendation
  };
}

export async function analyzePolicy(payload) {
  const text = payload?.text || "";
  const trackers = payload?.trackers || [];
  const ruleResult = runRuleEngine(text);
  const riskyExtract = extractRelevantSentences(text);
  const filteredText = riskyExtract || text.slice(0, 1800);
  const signals = {
    trackers,
    permissions: payload?.permissions || [],
    ruleRisk: ruleResult.totalRisk
  };

  if (!filteredText) {
    return { ...EMPTY_OUTPUT, privacy_score: 100, danger_level: "Safe", trackers_detected: trackers };
  }

  const aiFromBackend = await requestOllamaSummary({ text: filteredText, signals });
  const aiDirect = aiFromBackend || (await requestOllamaDirect(buildPrompt(filteredText, signals)));

  return mergeOutputs(ruleResult, aiDirect, trackers);
}
