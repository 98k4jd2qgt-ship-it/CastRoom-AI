import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`[validate-room-ai-output-no-public-at-mentions] ${message}`);
  process.exit(1);
};

const main = read("src/main.ts");
const visibility = read("src/core/roomVisibility.ts");

if (!main.includes("function sanitizeRoomAiAtMentions")) {
  fail("main.ts must sanitize AI-authored @mentions before committing room messages.");
}
if (!main.includes("sanitizeRoomAiAtMentions(providerTextBase, consoleState.room)")) {
  fail("provider text must pass through sanitizeRoomAiAtMentions.");
}
if (main.includes("providerUsedMention ? providerAddressing.target")) {
  fail("AI-authored @mentions must not override the scheduled target.");
}
if (main.includes("providerUsedMention ? providerAddressing.mentions")) {
  fail("AI-authored @mentions must not create structured mentions.");
}
if (!main.includes("Room.aiDirectorMentionBlocked")) {
  fail("AI-authored @Director attempts should be audited as blocked.");
}
if (!main.includes("public_director_target_blocked") || !main.includes("public_director_mention_blocked")) {
  fail("public timeline guard must reject structured Director targets and mentions.");
}
if (!main.includes("Do not use @mentions in the message body")) {
  fail("room speaker prompts must forbid @mentions in the body.");
}
if (!main.includes("Never write @Director or use @ to schedule anyone")) {
  fail("room speaker prompts must forbid AI scheduling through @Director or @role.");
}
if (!main.includes("Public @mentions never create privacy")) {
  fail("room speaker prompts must state public @mentions do not create privacy.");
}
if (!visibility.includes('return { visibility: "public", visibleTo: undefined, privateReason: undefined };')) {
  fail("public @role messages must not be silently converted into private AI whispers.");
}

console.log("[validate-room-ai-output-no-public-at-mentions] ok");
