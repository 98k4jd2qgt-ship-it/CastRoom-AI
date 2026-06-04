import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const failures = [];

const syncTimer = sliceFunction(main, "syncRoomAutoTimer");
mustIncludeIn(syncTimer, "hasRunnableRoomAutoWork()", "Timer sync delegates runnable finite work checks");

const runAuto = sliceFunction(main, "runRoomAutoTurn");
mustIncludeIn(runAuto, "hasRunnableRoomAutoWork()", "Auto turn entry allows finite work while autoChat is paused");

const workHelper = sliceFunction(main, "hasRunnableRoomAutoWork");
mustIncludeIn(workHelper, "hasRunnablePendingFollowup", "Runnable work includes pending follow-up");
mustIncludeIn(workHelper, "hasActiveDiscussionPlan", "Runnable work includes finite discussion plan");
mustIncludeIn(workHelper, "consoleState.room.autoChat", "Runnable work still includes continuous auto chat");

const applySchedule = sliceFunction(main, "applyRoomScheduleResultAsync");
mustIncludeIn(applySchedule, "shouldScheduleFiniteRoomFlowAfterTurn(result)", "Role turn completion checks finite continuation");
mustIncludeIn(applySchedule, "primeRoomAutoTimer", "Finite continuation can prime next timer after a role turn");

const finiteAfterTurn = sliceFunction(main, "shouldScheduleFiniteRoomFlowAfterTurn");
mustIncludeIn(finiteAfterTurn, "result.type !== \"turn\"", "Finite continuation only follows committed role turns");
mustIncludeIn(finiteAfterTurn, "consoleState.room.activeDiscussionPlan?.status === \"running\"", "Finite continuation respects active discussion plan");
mustIncludeIn(finiteAfterTurn, "hasPendingDebateSpeakerAfterTurn", "Finite continuation respects remaining debate speakers");

const debateHelper = sliceFunction(main, "hasPendingDebateSpeakerAfterTurn");
mustIncludeIn(debateHelper, "resolveNextDebateSpeakerAssignment", "Finite debate continuation uses debate policy next speaker");

mustInclude(scheduler, "!room.autoChat && !hasActivePlannedTurn && !pendingFollowup", "Scheduler manual pause allows finite pending follow-up");

if (failures.length) {
  console.error(`Finite room flow while auto paused validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("[finite-room-flow-while-auto-paused] ok");

function sliceFunction(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  const start = match?.index ?? -1;
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const candidates = ["\nfunction ", "\nasync function ", "\ninterface ", "\nconst "]
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
