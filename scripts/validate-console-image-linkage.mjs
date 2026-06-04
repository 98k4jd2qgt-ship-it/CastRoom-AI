import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");
const runtime = read("src/core/cloudTurnRuntime.ts");
const pipeline = read("src/core/pipeline.ts");
const audit = read("src/core/aiRequestAudit.ts");
const trace = read("src/core/chatTurnTrace.ts");

mustInclude(audit, [
  '"vision_caption"',
]);

mustInclude(trace, [
  '"vision_request_started"',
  '"vision_caption_committed"',
  '"chat_request_started"',
]);

mustInclude(runtime, [
  "export class CloudTurnRuntime",
  "createAuditedCloudProvider",
  "createProviderWithAuditedVision",
  'purpose: options.visionPurpose ?? "vision_caption"',
  "runOneOnOneTurn({",
  "withAiRequestAuditMetadata(input.config, audit)",
]);

mustInclude(main, [
  "function canAttemptVisionCaption",
  "function resolveConsoleTurnProviders",
  "cloudTurnRuntime.run",
  "createProviderWithAuditedVision",
  'chatPurpose: "console_chat"',
  'visionPurpose: "vision_caption"',
  'stage: "vision_caption_committed"',
  "Image understanding model is not configured or available for this image.",
]);

mustInclude(pipeline, [
  "input.provider.vision(context.imageContext",
  "createImageCaptionContext",
  "input.provider.chat(finalContext",
]);
assertOrder(pipeline, "input.provider.vision(context.imageContext", "input.provider.chat(finalContext");

mustNotInclude(main, [
  "liveChatProvider.chatWithConfig(withAiRequestAuditMetadata(readLiveAiConfig(\"chat\")",
  "liveVisionProvider.visionWithConfig(withAiRequestAuditMetadata(readLiveAiConfig(\"vision\")",
]);

if (failures.length) {
  console.error("Console image linkage validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Console image linkage validation passed.");

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

function assertOrder(text, first, second) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  if (firstIndex === -1 || secondIndex === -1) {
    failures.push(`Cannot verify order: ${first} before ${second}`);
    return;
  }
  if (firstIndex > secondIndex) {
    failures.push(`Wrong order: ${first} should appear before ${second}`);
  }
}
