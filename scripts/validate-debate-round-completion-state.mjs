import fs from "node:fs";

const debate = fs.readFileSync("src/core/debatePolicy.ts", "utf8");
const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const failures = [];

mustInclude(debate, "function pendingDebateSpeakerAssignmentsForRound", "debate policy computes current-round pending speakers");
mustInclude(debate, "debateSpokenRoleIdsForRound", "pending speakers exclude current-round spoken roles");
mustInclude(debate, "debateSkippedRoleIdsForRound", "pending speakers exclude current-round skipped roles");

const advanceRound = sliceFunction(debate, "advanceDebateMatchAfterRoundProgress");
mustIncludeIn(advanceRound, 'lifecyclePhase === "verdict_due"', "round progress respects verdict_due lifecycle");
mustIncludeIn(advanceRound, "nextSpeakerRoleId: undefined", "verdict_due clears next speaker");
mustIncludeIn(advanceRound, "pendingForRound[0]", "round progress uses first unfinished speaker");
mustIncludeIn(advanceRound, "nextRound = (nextMatch.round || 1) + 1", "completed round advances to next round when no verdict is due");
mustIncludeIn(advanceRound, "round: nextRound", "completed round creates a new round before picking the next speaker");

const nextSpeaker = sliceFunction(debate, "resolveNextDebateSpeakerAssignment");
mustIncludeIn(nextSpeaker, "pendingDebateSpeakerAssignmentsForRound(room, visibleRoleIds)", "next speaker is picked from current-round pending speakers");
mustIncludeIn(nextSpeaker, "pending.some((assignment) => assignment.roleId === configuredNext.roleId)", "configured next speaker must still be pending");
mustIncludeIn(nextSpeaker, "return null", "no pending speaker returns null instead of recycling old roles");

const afterSpeaker = sliceFunction(debate, "advanceDebateMatchAfterSpeaker");
mustIncludeIn(afterSpeaker, "spokenRoleIdsByRound", "speaker completion records current-round spoken roles");
mustIncludeIn(afterSpeaker, "advanceDebateMatchAfterRoundProgress(room, matchWithSpoken)", "speaker completion reuses round progress guard");

const afterSkip = sliceFunction(debate, "advanceDebateMatchAfterSkippedSpeaker");
mustIncludeIn(afterSkip, "advanceDebateMatchAfterRoundProgress(room, matchWithSkipped)", "skip recovery reuses round progress guard");

mustInclude(scheduler, "resolveNextDebateSpeakerAssignment(room)", "scheduler asks debate policy for next speaker");
mustInclude(scheduler, "debate_next_speaker", "scheduler labels directed debate next-speaker intents");
mustInclude(scheduler, "isStaleDebatePlannedTurn", "stale debate plan cannot override current round completion state");

if (failures.length) {
  console.error(`Debate round completion state validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("[debate-round-completion-state] ok");

function sliceFunction(source, name) {
  const match = new RegExp(`export\\s+function\\s+${name}\\s*\\(|function\\s+${name}\\s*\\(`).exec(source);
  const start = match?.index ?? -1;
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const candidates = ["\nexport function ", "\nfunction ", "\nconst "]
    .map((marker) => source.indexOf(marker, start + 1))
    .filter((index) => index >= 0);
  const next = candidates.length ? Math.min(...candidates) : -1;
  return next < 0 ? source.slice(start) : source.slice(start, next);
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}

function mustIncludeIn(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}
