import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mainPath = path.join(root, "src", "main.ts");
const source = fs.readFileSync(mainPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`[validate-room-timeline-patch-after-speaker-commit] ${message}`);
    process.exit(1);
  }
}

assert(
  source.includes("function scheduleRoomTimelineCommitFlush(messageId: string, reason: string, attempt = 0)"),
  "timeline commits must schedule a render flush",
);
assert(
  source.includes("function ensureRoomTimelineMessageRendered(messageId: string, reason: string, attempt: number)"),
  "timeline flush must verify the message appears in the DOM",
);
assert(
  source.includes(".room-surface-timeline"),
  "timeline flush verification must target the room timeline only",
);
assert(
  source.includes("[data-message-id="),
  "timeline flush verification must check the committed message id",
);
assert(
  source.includes("notifyRoomTimelineUpdated();"),
  "missing timeline DOM rows must retry a timeline-only patch",
);
assert(
  source.includes('scheduleRoomTimelineCommitFlush(message.id, "room_speaker_message");'),
  "speaker commits must schedule timeline flush verification",
);

console.log("[validate-room-timeline-patch-after-speaker-commit] ok");
