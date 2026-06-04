import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const ai = read("src/core/ai.ts");
const gateway = read("src/core/aiGateway.ts");
const runtime = read("src/core/cloudTurnRuntime.ts");
const main = read("src/main.ts");
const rust = read("src-tauri/src/lib.rs");

mustInclude(gateway, [
  "requestId?: string;",
  "purpose?: AiRequestPurpose;",
  "turnId?: string | null;",
  "requestId?: string | null;",
  "purpose?: AiRequestPurpose | null;",
  "recordUnscopedRequest",
  "unscoped_cloud_request",
]);

mustInclude(ai, [
  "requestId?: string;",
  "requestPurpose?: AiRequestPurpose;",
  "turnId?: string | null;",
  "requestId: config.requestId",
  "purpose: config.requestPurpose",
  "turnId: config.turnId ?? null",
  "const timeoutMs = 60_000;",
]);

mustInclude(main, [
  'from "./core/cloudTurnRuntime"',
  "createProviderWithAuditedVision",
  "withAiRequestAuditMetadata",
  "withAiRequestAuditMetadata(readLiveAiConfig(use), audit)",
  "requestTtsSpeech(withAiRequestAuditMetadata",
  "liveChatProvider.rawChatWithConfig",
]);

mustInclude(runtime, [
  "createAuditedCloudProvider",
  "requestId: audit.requestId",
  "requestPurpose: audit.purpose",
  "turnId: audit.turnId",
]);

mustNotInclude(main, [
  "liveChatProvider.chatWithConfig(withAiRequestAuditMetadata(readLiveAiConfig(\"chat\")",
  "liveVisionProvider.visionWithConfig(withAiRequestAuditMetadata(readLiveAiConfig(\"vision\")",
]);

mustInclude(rust, [
  "request_id: Option<String>",
  "purpose: Option<String>",
  "turn_id: Option<String>",
  "request_id,",
  "purpose,",
  "turn_id,",
  "timeout_ms.unwrap_or(60_000)",
]);

if (failures.length) {
  console.error("Unscoped cloud request validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Unscoped cloud request validation passed.");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, needles) {
  for (const needle of needles) {
    if (!text.includes(needle)) {
      failures.push(`Missing required text: ${needle}`);
    }
  }
}

function mustNotInclude(text, needles) {
  for (const needle of needles) {
    if (text.includes(needle)) {
      failures.push(`Forbidden text is present: ${needle}`);
    }
  }
}
