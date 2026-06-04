import fs from "node:fs";

const source = fs.readFileSync("src/core/persistence.ts", "utf8");
const failures = [];

mustInclude("function normalizeRestoredMessage");
mustInclude("message.target ?? \"all\"");
mustInclude("message.visibility ?? \"public\"");
mustInclude("message.channelId ??");
mustInclude("sanitizeRestoredEndpoint");
mustInclude("runtimeStatus: \"idle\"");
mustInclude("lastRuntimeMessage: \"\"");

mustNotInclude("target: \"all\",\n        mentions: [],\n        visibility: \"public\"");
mustNotInclude("connectionStatus: \"not_configured\",\n    lastTestMessage: \"Local settings were restored");
mustNotInclude("availableModels: [],\n    capabilitySummary: base.ai.capabilitySummary,\n    lastErrorCode: null");

if (failures.length > 0) {
  console.error(`Persistence semantics validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Persistence semantics validation passed");

function mustInclude(marker) {
  if (!source.includes(marker)) {
    failures.push(`missing marker: ${marker}`);
  }
}

function mustNotInclude(marker) {
  if (source.includes(marker)) {
    failures.push(`forbidden marker remains: ${marker}`);
  }
}
