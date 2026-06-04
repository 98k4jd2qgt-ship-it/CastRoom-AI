import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scheduler = fs.readFileSync(path.join(root, "src/core/roomScheduler.ts"), "utf8");
const copy = fs.readFileSync(path.join(root, "src/ui/copy.ts"), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(scheduler.includes("explicitRoomTaskPattern"), "Explicit task signal pattern is missing.");
assert(scheduler.includes('kind: silentByPrompt ? "silent_allowed" : "optional"'), "Non-mention ambient input must be optional or silent_allowed.");
assert(scheduler.includes('action: "no_action"'), "Optional/silent input must be allowed to produce no public reply.");
assert(scheduler.includes('shouldSpeakDecision?.action === "no_action"'), "No-action input should stop before speaker provider hot path.");
assert(scheduler.includes("!hasActivePlannedTurn"), "No-action input must not interrupt active finite discussion plans.");
assert(scheduler.includes("!room.autoChat"), "No-action input must not block continuous auto room flow.");
assert(scheduler.includes("recordInputProcessed("), "Silent/optional input must still be recorded for diagnostics.");
assert(copy.includes("engagement_silent_allowed"), "i18n copy for silent_allowed engagement is missing.");
assert(copy.includes("shouldSpeak_no_action"), "i18n copy for no_action should-speak decision is missing.");

console.log("Room optional silent input validation passed.");
