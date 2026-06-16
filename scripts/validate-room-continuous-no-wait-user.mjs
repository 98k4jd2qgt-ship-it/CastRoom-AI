import fs from "node:fs";

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const policyBlockedAutoResult = sliceFunction(scheduler, "policyBlockedAutoResult");
const scheduleRoomTurn = sliceFunction(scheduler, "scheduleRoomTurn");
const shouldWaitForUserAfterDirector = sliceFunction(main, "shouldWaitForUserAfterDirector");
const directorResultRequiresHardUserInput = sliceFunction(main, "directorResultRequiresHardUserInput");
const advanceRoomDiscussionPlanAfterTurn = sliceFunction(main, "advanceRoomDiscussionPlanAfterTurn");
const providerSkippedBlock = sliceBetween(main, 'if (providerTurn?.kind === "skipped")', "const providerResult = providerTurn?.kind");
const privateWhisperLimitBlock = sliceBetween(main, 'if (message.visibility === "private_ai" && reachedPrivateWhisperLimit', "queueRoomParticipantIdle(result.participant.id)");

mustInclude(scheduler, "export function isContinuousRoomFlow", "central continuous Room Flow helper");
mustInclude(scheduler, "function isHardRoomAutoBlock", "hard blocker whitelist helper");
mustInclude(policyBlockedAutoResult, "continuousSoftBlock", "continuous soft blockers override pause");
mustInclude(policyBlockedAutoResult, 'action: "continue"', "continuous soft blockers are converted to continue");
mustInclude(policyBlockedAutoResult, "createPolicyPendingFollowup", "continuous soft blockers try a pending role follow-up first");
mustInclude(policyBlockedAutoResult, "createCasualTopicShiftSpeechIntent(room, input, addressing, reason)", "continuous soft blockers can become casual topic shifts");
mustInclude(policyBlockedAutoResult, "createAutonomousFallbackSpeechIntent(room, input, addressing, reason)", "continuous soft blockers can become autonomous role turns");
mustInclude(policyBlockedAutoResult, 'stop(reason, "cooling_down", room, nowMs + delayMs)', "continuous fallback reschedules instead of waiting for user");

mustInclude(scheduleRoomTurn, 'if (trigger === "auto" && shouldContinueRoomAutoAfterBeat(room))', "auto continuous no-speech branch is handled before waiting_user");
mustInclude(scheduleRoomTurn, 'createCasualTopicShiftSpeechIntent(room, input, addressing, speechIntent?.reason ?? "no_candidate")', "continuous no-candidate path tries topic shift");
mustInclude(scheduleRoomTurn, 'createAutonomousFallbackSpeechIntent(room, input, addressing, speechIntent?.reason ?? "no_candidate")', "continuous no-candidate path tries role fallback");
mustInclude(scheduleRoomTurn, '...stop("no_candidate", "cooling_down", room, nowMs + delayMs)', "continuous no-candidate path cools down instead of stopping");
mustNotInclude(scheduleRoomTurn, 'lastMessageTargetsUserQuestion(room)) {\n      return stop("waiting_user"', "direct user question wait in continuous path");

mustInclude(providerSkippedBlock, 'const shouldContinueAuto = consoleState.room.autoChat && consoleState.room.advancePolicy === "continuous"', "provider repeat skip detects continuous flow");
mustInclude(providerSkippedBlock, "if (shouldContinueAuto)", "continuous repeated speaker skip has a dedicated branch");
mustInclude(providerSkippedBlock, "commitRoomDiagnosticPatch", "continuous repeated speaker skip writes diagnostics only");
mustInclude(providerSkippedBlock, 'stopReason: "repeated"', "non-continuous repeated speaker skip can still expose repeated stop reason");
mustInclude(providerSkippedBlock, 'status: shouldContinueAuto ? "cooling_down" : "waiting_user"', "continuous repeated speaker skip cools down");
mustInclude(providerSkippedBlock, "nextTurnAt,", "continuous repeated speaker skip keeps a next turn");

mustInclude(privateWhisperLimitBlock, "isContinuousRoomFlow(consoleState.room)", "private whisper limit has a continuous branch");
mustInclude(privateWhisperLimitBlock, 'status: "cooling_down"', "private whisper limit keeps continuous queued");
mustInclude(privateWhisperLimitBlock, 'lastReason: "director_followup"', "private whisper limit does not write waiting_user in continuous");
mustInclude(privateWhisperLimitBlock, "room_private_whisper_limit_continuous", "private whisper continuous path is diagnostic-only");

mustInclude(shouldWaitForUserAfterDirector, "continuousRoomFlow", "Director wait helper knows continuous flow");
mustInclude(shouldWaitForUserAfterDirector, "if (continuousRoomFlow)", "Director wait helper checks continuous before user wait logic");
mustInclude(shouldWaitForUserAfterDirector, "return false", "Director stop without message does not force waiting_user in continuous flow");
mustInclude(directorResultRequiresHardUserInput, "isContinuousRoomFlow(consoleState.room)", "Director hard-input helper has continuous branch");
mustInclude(directorResultRequiresHardUserInput, 'blockingNeed === "privacy_or_safety"', "Director hard wait keeps safety blockers");
mustInclude(directorResultRequiresHardUserInput, 'blockingNeed === "provider_failure"', "Director hard wait keeps provider failures");
mustInclude(scheduler, "&& !isContinuousRoomFlow(input.room)", "Director plan waitForUser cannot mark waiting_user in continuous flow");

mustInclude(advanceRoomDiscussionPlanAfterTurn, 'consoleState.room.autoChat && consoleState.room.advancePolicy === "continuous"', "completed short discussion plans respect continuous flow");
mustInclude(advanceRoomDiscussionPlanAfterTurn, 'type: "room.setDiscussionPlan", plan: null', "continuous short discussion plan completion clears the plan");
mustInclude(advanceRoomDiscussionPlanAfterTurn, 'terminationReason: null', "continuous short discussion plan completion does not show waiting player");

if (failures.length) {
  console.error(`Room continuous no-wait-user validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room continuous no-wait-user validation passed.");

function sliceFunction(source, name) {
  const start = Math.max(source.indexOf(`function ${name}`), source.indexOf(`export function ${name}`));
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const nextExport = source.indexOf("\nexport function ", start + 1);
  const nextPlain = source.indexOf("\nfunction ", start + 1);
  const candidates = [nextExport, nextPlain].filter((index) => index >= 0);
  return candidates.length ? source.slice(start, Math.min(...candidates)) : source.slice(start);
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) {
    failures.push(`missing block start: ${startMarker}`);
    return "";
  }
  const end = source.indexOf(endMarker, start + startMarker.length);
  return end >= 0 ? source.slice(start, end) : source.slice(start);
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}

function mustNotInclude(text, marker, label) {
  if (text.includes(marker)) {
    failures.push(`unexpected ${label}: ${marker}`);
  }
}
