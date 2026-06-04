import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[debate-repetition-recovery] ${message}`);
    process.exitCode = 1;
  }
}

const types = read("src/core/types.ts");
const appState = read("src/core/appState.ts");
const debate = read("src/core/debatePolicy.ts");
const main = read("src/main.ts");

assert(types.includes("skippedRoleIdsByRound"), "RoomMatchState must track skipped debate speakers by round");
assert(appState.includes("skippedRoleIdsByRound: {}"), "Default match state must initialize skipped speakers");
assert(
  appState.includes("recoverDebateSpokenRoleIdsFromTimeline"),
  "App state must recover debate progress from existing public timeline messages",
);
assert(
  debate.includes("debateSkippedRoleIdsForRound") &&
    debate.includes("advanceDebateMatchAfterSkippedSpeaker") &&
    debate.includes("skippedRequiredSpeakerCount"),
  "Debate policy must model skipped speakers and include them in lifecycle progress",
);
assert(
  main.includes("isRepeatedRoomProviderOutput") &&
    main.includes("advanceDebateMatchAfterSkippedSpeaker") &&
    main.includes("room_speaker_repeated_skip"),
  "Room provider hot path must skip repeated debate output instead of committing it",
);
assert(
  main.includes("completeRoomDiscussionPlan(\"repeated\")"),
  "Repeated provider output must terminate stale active plans",
);

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[debate-repetition-recovery] ok");
