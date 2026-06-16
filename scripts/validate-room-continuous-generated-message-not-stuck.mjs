import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mainPath = path.join(root, "src", "main.ts");
const source = fs.readFileSync(mainPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`[validate-room-continuous-generated-message-not-stuck] ${message}`);
    process.exit(1);
  }
}

const failureIndex = source.indexOf("Room.speaker.visibleCommitFailed");
const memoryIndex = source.indexOf("roomMemoryAdapter.recordSpeakerMessage", failureIndex);
const returnIndex = source.indexOf("return;", failureIndex);
const timerIndex = source.indexOf("primeRoomAutoTimer(", failureIndex);

assert(failureIndex >= 0, "speaker visible commit failures must be diagnosed explicitly");
assert(
  source.includes("A role reply was generated but could not be committed to the public timeline."),
  "generated-but-uncommitted speaker replies must have a clear diagnostic status",
);
assert(returnIndex > failureIndex, "generated-but-uncommitted speaker replies must stop the success finalization path");
assert(memoryIndex > returnIndex, "room memory must not be recorded before the failed-commit return");
assert(timerIndex > returnIndex, "next auto timer must not be primed before the failed-commit return");
assert(
  source.includes("scheduleContinuousRetry(\"no_runnable_work\"") ||
    source.includes("scheduleContinuousRetry('no_runnable_work'"),
  "continuous no-runnable work must remain a retry path, not a permanent stop",
);

console.log("[validate-room-continuous-generated-message-not-stuck] ok");
