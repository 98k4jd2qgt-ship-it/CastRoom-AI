import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mainPath = path.join(root, "src", "main.ts");
const source = fs.readFileSync(mainPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`[validate-room-runtime-effect-timeline-messages] ${message}`);
    process.exit(1);
  }
}

assert(
  source.includes("function commitRoomRuntimeTimelineMessages(messages?: unknown[])"),
  "main.ts must include a runtime timeline message commit helper",
);
assert(
  source.includes("function isRuntimeTimelineMessage(value: unknown): value is ConsoleMessage"),
  "runtime timeline messages must be validated before commit",
);
assert(
  source.includes('commitRoomTimelineMessage(candidate, "room_runtime_effect_timeline")'),
  "runtime timeline messages must be committed through the normal room timeline commit path",
);
assert(
  source.includes("commitRoomRuntimeTimelineMessages(effect.timelineMessages);"),
  "applyRoomRuntimeEffect must consume effect.timelineMessages",
);
assert(
  source.includes('scheduleRoomTimelineCommitFlush(candidate.id, "room_runtime_effect_timeline")'),
  "runtime timeline messages must schedule a timeline flush after commit",
);

console.log("[validate-room-runtime-effect-timeline-messages] ok");
