import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scheduler = fs.readFileSync(path.join(root, "src/core/roomScheduler.ts"), "utf8");
const types = fs.readFileSync(path.join(root, "src/core/types.ts"), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(scheduler.includes("function hasExplicitMention("), "Mention detection helper is missing.");
assert(scheduler.includes('text.includes("@")'), "@ mention must be treated as explicit engagement.");
assert(scheduler.includes('kind: "required"'), "Explicit mention/task must produce required engagement.");
assert(scheduler.includes('reason: explicitMention ? "explicit_mention" : "explicit_task"'), "Required engagement should distinguish mention from task.");
assert(scheduler.includes("engagement?.kind !== \"required\""), "ResponseObligation must only be created for required Room input.");
assert(scheduler.includes('action: "speak_public"'), "Required engagement should request a public speak outcome.");
assert(types.includes("requiresVisibleOutcome: boolean"), "Engagement/ShouldSpeak types must expose visible outcome requirement.");
assert(scheduler.includes("ensureScheduleResultHasOutcome"), "Required engagement must still pass no-silent outcome guard.");

console.log("Room mention must respond validation passed.");
