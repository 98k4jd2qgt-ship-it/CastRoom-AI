import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mainPath = path.join(root, "src", "main.ts");
const source = fs.readFileSync(mainPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`[validate-director-immediate-room-context] ${message}`);
    process.exit(1);
  }
}

const commitIndex = source.indexOf('const speakerCommitResult = commitRoomTimelineMessage(message, "room_speaker_message");');
const memoryIndex = source.indexOf("roomMemoryAdapter.recordSpeakerMessage", commitIndex);
const directorIndex = source.indexOf('applyDirectorTickAfterMessage(message, "role")', commitIndex);
const timerIndex = source.indexOf("primeRoomAutoTimer(", directorIndex);

assert(commitIndex >= 0, "speaker messages must be committed to timeline before follow-up work");
assert(memoryIndex > commitIndex, "speaker public activity must be recorded after timeline commit");
assert(directorIndex > memoryIndex, "Director tick must run after the committed speaker message is recorded");
assert(timerIndex > directorIndex, "next auto timer must be scheduled after Director has immediate room context");
assert(
  source.includes("Director Channel 内容不进入共同记忆") === false,
  "validation should rely on code order, not documentation text",
);

console.log("[validate-director-immediate-room-context] ok");
