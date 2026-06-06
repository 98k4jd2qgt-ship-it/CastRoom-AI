import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const roomRuntime = fs.readFileSync("src/core/roomRuntime.ts", "utf8");
const types = fs.readFileSync("src/core/types.ts", "utf8");
const failures = [];

mustInclude(roomRuntime, '"schedule_once"', "RoomRuntime supports one-shot followup timer action");
mustInclude(types, '| "director_followup"', "RoomScheduleReason includes director followup reason");
mustInclude(types, "RoomPendingFollowup", "Room auto speech state can carry executable follow-up");

const directorTurn = sliceFunction("applyRoomDirectorTurnAsync");
mustIncludeIn(directorTurn, "effect: (submitResult) =>", "Director runtime effect is derived from Director body result");
mustIncludeIn(directorTurn, "pendingFollowup: submitResult.ok ? submitResult.result.pendingFollowup : undefined", "Director body can return executable follow-up");

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
mustInclude(scheduler, 'isDirectorPublicSchedulingText(plan.publicText)', "Director public text blocks scheduling language");
mustInclude(scheduler, 'return "narration";', "Director cue/twist can publish narration beats");
mustInclude(scheduler, "isExplicitPublicDirectorTextRequest(userInput, move)", "Director explicit public request helper is retained for recap compatibility");
mustInclude(scheduler, 'reason !== "mentioned"', "Director private directives only consider @You for explicit Director mentions");
mustInclude(scheduler, "shouldTargetUserForDirectorDirective(room, userInput, modeIntent, reason)", "Director private directives decide whether the user is a valid target");
mustInclude(scheduler, 'target: shouldTargetUserForDirectorDirective(room, userInput, modeIntent, reason)', "Director follow-up directives do not default to @You");
mustInclude(scheduler, "policyBlockedAutoResult(room, \"repetition_guard\", \"soft_user_preference\"", "Auto repetition guard is policy-gated instead of forced public stopping");
mustInclude(scheduler, "createAutonomousFallbackSpeechIntent", "Auto scheduler has a role fast path before asking Director");
mustInclude(scheduler, "shouldUseRoleFastPathForAutoDirectorPlan", "Auto Director planned turns can be downgraded to role fast path");
mustNotInclude(scheduler, 'directorHandoff("repetition_guard", room, nowMs + delayMs)', "Auto repetition guard no longer forces Director handoff");

const directorBody = sliceFunction("executeRoomDirectorTurnBody");
mustIncludeIn(directorBody, "const directorEffect = applyRoomDirectorTurn(result)", "Director body captures apply effect");
mustIncludeIn(directorBody, "pendingFollowup: directorEffect.pendingFollowup", "Director body returns pending follow-up");

const applyDirector = sliceFunction("applyRoomDirectorTurn");
mustIncludeIn(applyDirector, "const pendingFollowup = createDirectorPendingFollowup(result)", "Director apply path computes executable follow-up");
mustIncludeIn(applyDirector, "const followupTimerAction = directorFollowupTimerAction(result)", "Director apply path computes follow-up timer action");
mustIncludeIn(applyDirector, "canContinueWithoutPublicText", "Repeated Director public text can be skipped without blocking followup");
mustIncludeIn(applyDirector, "pendingFollowup: canContinueWithoutPublicText ? pendingFollowup : null", "Repeated Director text preserves safe follow-up when public text is blocked");

const followupFn = sliceFunction("directorFollowupTimerAction");
mustIncludeIn(followupFn, 'return "clear_wait_user"', "Director choice/pause clears timer and waits for user");
mustIncludeIn(followupFn, "hasExecutableDirectorFollowup(result)", "Director timer action checks executable follow-up before waiting");
mustIncludeIn(followupFn, 'return "schedule_once"', "Director follow-up schedules a finite one-shot timer");

const createFollowup = sliceFunction("createDirectorPendingFollowup");
mustIncludeIn(createFollowup, 'mode: "one_shot"', "Director follow-up is finite by default");
mustIncludeIn(createFollowup, "targetRoleId", "Director follow-up can target a role");
mustIncludeIn(createFollowup, "privateDirective", "Director private directives can drive hidden follow-up tasks");

const sanitizePublicTextReason = sliceFunction("sanitizeDirectorPublicTextReason");
mustIncludeIn(sanitizePublicTextReason, 'fallbackReason === "none"', "Live Director plans cannot escalate hidden recaps into public text");
mustIncludeIn(sanitizePublicTextReason, 'value === "recap" || value === "round_transition" || value === "narration"', "Live Director public recap/cue/narration escalation is blocked");

const applyEffect = sliceFunction("applyRoomRuntimeEffect");
mustIncludeIn(applyEffect, 'effect.nextTimerAction === "schedule_once"', "RoomRuntime effect handles one-shot schedule action");
mustIncludeIn(applyEffect, 'primeRoomAutoTimer("director_followup", false, pending)', "Schedule action primes Director followup timer with pending state");
mustIncludeIn(applyEffect, "canScheduleRoomRuntimeFollowup(effect.pendingFollowup)", "Schedule action is gated by explicit follow-up or room auto state");

if (failures.length) {
  console.error(`Director public followup validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("[director-public-followup] ok");

function sliceFunction(name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(main);
  const start = match?.index ?? -1;
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const candidates = ["\nfunction ", "\nasync function ", "\ninterface "]
    .map((marker) => main.indexOf(marker, start + 1))
    .filter((index) => index >= 0);
  const next = candidates.length ? Math.min(...candidates) : -1;
  return next < 0 ? main.slice(start) : main.slice(start, next);
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

function mustNotInclude(text, marker, label) {
  if (text.includes(marker)) {
    failures.push(`unexpected ${label}: ${marker}`);
  }
}
