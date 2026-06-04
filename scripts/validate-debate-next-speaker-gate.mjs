import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[debate-next-speaker-gate] ${message}`);
    process.exitCode = 1;
  }
}

const scheduler = read("src/core/roomScheduler.ts");
const debate = read("src/core/debatePolicy.ts");

assert(
  scheduler.includes("selectDirectedDebateSpeechIntent"),
  "Room scheduler must hard-gate debate turns through the configured next speaker",
);
assert(
  scheduler.includes("validateNextSpeakerEligibility"),
  "Room scheduler must validate speaker eligibility before executing role turns",
);
assert(
  scheduler.indexOf("const directedDebateIntent = selectDirectedDebateSpeechIntent") >= 0 &&
    scheduler.indexOf("const directedDebateIntent = selectDirectedDebateSpeechIntent") < scheduler.indexOf("const huddleIntent = intents"),
  "Directed debate speaker must be selected before huddle/priority fallback",
);
assert(
  scheduler.includes("resolveNextDebateSpeakerAssignment(room)") &&
    scheduler.includes("roleId === nextAssignment.roleId") &&
    scheduler.includes("debate_next_speaker"),
  "Directed debate selection must use resolveNextDebateSpeakerAssignment and target its role id",
);
assert(
  scheduler.includes("isStaleDebatePlannedTurn") &&
    scheduler.includes("isStaleSpeakerPlannedTurn") &&
    scheduler.includes("terminateRoomPlan(discussionPlan, \"no_candidate\")"),
  "Stale active discussion plans must not override speaker eligibility state",
);
assert(
  scheduler.includes(".filter((intent) => validateNextSpeakerEligibility(room, intent).ok)"),
  "Generic speaker fallback must reject ineligible consecutive speakers",
);
assert(
  scheduler.includes("pending.privateDirective?.task ?? pending.summary ?? \"Director follow-up\"") &&
    scheduler.includes("priority: 0,"),
  "Pending follow-up eligibility must not bypass same-speaker guard via max priority",
);
assert(
  debate.includes("advanceDebateMatchAfterSpeaker") &&
    debate.includes("nextSpeakerRoleId"),
  "Debate policy must continue to advance nextSpeakerRoleId after a valid speaker turn",
);

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[debate-next-speaker-gate] ok");
