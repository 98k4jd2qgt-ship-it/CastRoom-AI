import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mainPath = path.join(root, "src", "main.ts");
const source = fs.readFileSync(mainPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`[validate-room-speaker-result-commit-flush] ${message}`);
    process.exit(1);
  }
}

const commitIndex = source.indexOf('const speakerCommitResult = commitRoomTimelineMessage(message, "room_speaker_message");');
const visibleIndex = source.indexOf("const speakerVisibleCommitted = isVisibleRoomTimelineCommit(speakerCommitResult);");
const markIndex = source.indexOf("markRoomProviderTurnVisibleCommitted(providerTurn);");
const flushIndex = source.indexOf('scheduleRoomTimelineCommitFlush(message.id, "room_speaker_message");');
const memoryIndex = source.indexOf("roomMemoryAdapter.recordSpeakerMessage");
const directorIndex = source.indexOf('applyDirectorTickAfterMessage(message, "role")');
const timerIndex = source.indexOf("primeRoomAutoTimer(", directorIndex);

assert(commitIndex >= 0, "speaker result must be committed through commitRoomTimelineMessage");
assert(visibleIndex > commitIndex, "speaker commit result must be checked before finalizing the turn");
assert(markIndex > visibleIndex, "runtime visible terminal flag must be marked only after visible commit succeeds");
assert(flushIndex > markIndex, "timeline flush must be scheduled after visible commit succeeds");
assert(memoryIndex > flushIndex, "room memory must be recorded after the visible timeline commit");
assert(directorIndex > memoryIndex, "Director tick must run after the speaker message is committed and recorded");
assert(timerIndex > directorIndex, "next auto timer must be primed after Director has seen the committed message");

console.log("[validate-room-speaker-result-commit-flush] ok");
