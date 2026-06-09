import fs from "node:fs";

function fail(message) {
  console.error(`Token usage audit validation failed:\n- ${message}`);
  process.exit(1);
}

function mustInclude(text, marker, message) {
  if (!text.includes(marker)) fail(`${message}: ${marker}`);
}

const types = fs.readFileSync("src/core/types.ts", "utf8");
const ai = fs.readFileSync("src/core/ai.ts", "utf8");
const audit = fs.readFileSync("src/core/aiRequestAudit.ts", "utf8");
const cloud = fs.readFileSync("src/core/cloudTurnRuntime.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");

mustInclude(types, "export interface AiTokenUsage", "AiTokenUsage type is defined");
mustInclude(types, "usage?: AiTokenUsage", "AiProviderResult exposes optional usage");
mustInclude(ai, "usage?: {", "OpenAI-compatible response accepts provider usage");
mustInclude(ai, "tokenUsageFromCompletion", "chat completion usage is normalized");
mustInclude(ai, "estimatedPromptTokens", "usage estimation exists for providers without reported usage");
mustInclude(audit, "usage?: AiTokenUsage", "request audit entry stores usage");
mustInclude(cloud, "usageAuditDetails(result)", "cloud runtime forwards usage to audit");
mustInclude(main, "formatAiUsageSummary", "diagnostics render usage summary");
mustInclude(main, "formatAiRequestPurposeAverageLines", "diagnostics render purpose-level token averages");
mustInclude(main, "purpose averages:", "token audit summaries include purpose averages");
mustInclude(main, "finishAiRequestAudit(audit, \"success\", { usage: planResult.usage })", "room planner raw chat usage is audited");

console.log("AI token usage audit validation passed.");
