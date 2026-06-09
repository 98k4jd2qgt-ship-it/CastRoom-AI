import fs from "node:fs";

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const scheduleRoomTurn = sliceFunction(scheduler, "scheduleRoomTurn");
mustInclude(scheduleRoomTurn, "policyBlockedAutoResult(room, \"question_loop\", \"user_answer_expected\"", "question-loop wait signal is policy-gated");
mustInclude(scheduleRoomTurn, "policyBlockedAutoResult(room, \"waiting_user\", \"user_answer_expected\"", "user-answer wait signal is policy-gated");
mustInclude(scheduleRoomTurn, "createCasualTopicShiftSpeechIntent(room, input, addressing, \"no_speaker_intent\")", "casual auto no-speaker path tries topic shift before waiting");
mustInclude(scheduleRoomTurn, "createAutonomousFallbackSpeechIntent(room, input, addressing, \"no_speaker_intent\")", "auto no-speaker path still has role fast path before waiting");
mustInclude(scheduleRoomTurn, "createCasualTopicShiftSpeechIntent(room, input, addressing, \"question_loop\")", "casual question-loop path can become topic shift before waiting");
mustInclude(scheduleRoomTurn, "createCasualTopicShiftSpeechIntent(room, input, addressing, \"repetition_guard\")", "casual repetition path can become topic shift before waiting");
mustInclude(scheduleRoomTurn, "selectedSpeechIntent?.decision === \"ask_director\" && trigger === \"auto\"", "auto Director speech intents are downgraded before handoff");
mustInclude(scheduleRoomTurn, "stop(\"waiting_user\", \"paused\", room, null)", "auto wait fallback pauses locally instead of forcing Director handoff");
mustNotInclude(scheduleRoomTurn, "directorHandoff(\"waiting_user\", room, nowMs + delayMs)", "wait signal forcing Director handoff");
mustNotInclude(scheduleRoomTurn, "lastMessageTargetsUserQuestion(room)) {\n      return stop(\"waiting_user\"", "direct user-question stop");
mustNotInclude(scheduleRoomTurn, "recentDirectorWaitingForUser(room)) {\n        return stop(\"waiting_user\"", "direct Director waiting stop");

const policyBlockedAutoResult = sliceFunction(scheduler, "policyBlockedAutoResult");
mustInclude(policyBlockedAutoResult, "advanceDecision.action === \"pause\"", "schedule uses advance decision before pausing");
mustInclude(policyBlockedAutoResult, "effectiveDecision.action === \"fill_gap\"", "fill-gap produces a finite continuation branch");
mustInclude(policyBlockedAutoResult, "createPolicyPendingFollowup", "fill-gap uses one-shot pending follow-up");

mustInclude(scheduler, "blockingNeed === \"privacy_or_safety\"", "privacy remains hard blocker");
mustInclude(scheduler, "blockingNeed === \"provider_failure\"", "provider failure remains hard blocker");
mustInclude(scheduler, "blockingNeed === \"irreversible_decision\"", "irreversible decision remains hard blocker");
mustInclude(scheduler, 'continuation.blockingNeed === "explicit_user_choice"', "explicit choice remains a hard pause");
mustInclude(scheduler, 'action = "fill_gap"', "fill-gap soft blockers stay finite");

mustInclude(main, "resolveContinuationAssessment(consoleState.room", "Director wait uses continuation assessment");
mustInclude(main, "resolveAdvanceDecision(consoleState.room", "Director wait uses advance decision");
mustInclude(main, "shouldWaitForUserAfterDirector(result)", "Director wait helper remains central");
mustInclude(main, 'if (action.type === "room.setAdvancePolicy")', "policy change uses local status update");

if (failures.length) {
  console.error(`Room autonomy wait policy validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room autonomy wait policy validation passed.");

function sliceFunction(source, name) {
  const start = Math.max(source.indexOf(`function ${name}`), source.indexOf(`export function ${name}`));
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const next = source.indexOf("\nexport function ", start + 1);
  const nextPlain = source.indexOf("\nfunction ", start + 1);
  const candidates = [next, nextPlain].filter((index) => index >= 0);
  return candidates.length ? source.slice(start, Math.min(...candidates)) : source.slice(start);
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
