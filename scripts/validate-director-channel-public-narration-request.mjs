import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");
const scheduler = read("src/core/roomScheduler.ts");

mustInclude(main, "function isDeveloperDirectorPublicNarrationRequest", "main classifies explicit Director Channel public narration requests");
mustInclude(main, "directorChannelPublicNarrationRequest", "Director Channel route computes public narration request intent");
mustInclude(main, "Developer Director Channel Public Narration Request", "Director Channel public narration requests are marked before scheduling");
mustInclude(main, "isDeveloperDirectorPublicNarrationRequest(input)", "Director Channel move inference uses the public narration helper");
mustInclude(main, "requestedMove: inferDeveloperDirectorChannelMove(input)", "Director Channel still uses inferred move routing");
mustInclude(main, "plan.publicTextReason !== \"narration\"", "live Director plans cannot silently downgrade explicit public narration requests");
mustInclude(main, "knowledgeVisibility: \"public\"", "explicit public narration fallback is public-safe after validation");
mustInclude(main, "shouldForceDirectorPublicTimelineMessage", "public Director narration bypasses active private/director channel routing");
mustInclude(main, "director_public_narration_barrier", "forced Director narration routing is marked for review");

mustInclude(scheduler, "developer director channel public narration request", "scheduler recognizes explicit Director Channel public narration marker");
mustInclude(scheduler, "Developer Director Channel Public Narration Request", "narration source sanitizer strips explicit request marker");
mustInclude(scheduler, "main\\s+channel", "public request detector supports English main channel wording");
mustInclude(scheduler, "\\u4e3b\\u9891\\u9053", "public request detector supports Chinese main channel wording");
mustInclude(scheduler, "function isExplicitPublicNarrationRequest", "scheduler distinguishes public narration from recap/ruling requests");
mustInclude(scheduler, "extractExplicitPublicNarrationBody", "scheduler extracts narration bodies without publishing command text");
mustInclude(scheduler, "modeIntent?.waitForUser && move !== \"pause\"", "soft wait-for-user handling is explicit");
mustInclude(scheduler, "return \"none\";", "soft wait-for-user does not become public choice text by default");
mustInclude(scheduler, "The room falls quiet for a beat", "explicit public narration without a body has a natural fallback");
mustNotInclude(scheduler, "like it is waiting for the next person", "explicit public narration fallback should not contain next-speaker wording");
mustNotInclude(scheduler, "waiting for someone to naturally continue", "casual public narration fallback should not read like speaker scheduling");

if (failures.length > 0) {
  console.error(`validate-director-channel-public-narration-request failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-channel-public-narration-request passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}

function mustNotInclude(text, marker, label) {
  if (text.includes(marker)) {
    failures.push(`${label}: unexpected ${marker}`);
  }
}
