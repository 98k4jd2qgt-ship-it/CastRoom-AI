import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const runtime = fs.readFileSync("src/core/roomRuntime.ts", "utf8");
const appState = fs.readFileSync("src/core/appState.ts", "utf8");
const types = fs.readFileSync("src/core/types.ts", "utf8");
const failures = [];

mustInclude(types, "export interface RoomPendingFollowup", "Room pending follow-up state type");
mustInclude(types, "pendingFollowup?: RoomPendingFollowup | null", "Room auto speech state stores pending follow-up");
mustInclude(appState, "pendingFollowup: null", "default room auto speech state clears pending follow-up");
mustInclude(appState, "action.pendingFollowup === undefined", "auto speech reducers preserve pending follow-up unless explicitly patched");

mustInclude(runtime, '"schedule_once"', "RoomRuntime supports one-shot scheduling");
mustInclude(runtime, '"schedule_continuous"', "RoomRuntime supports continuous scheduling");
mustInclude(runtime, '"clear_wait_user"', "RoomRuntime can explicitly wait for user");
mustInclude(runtime, "pendingFollowup?: RoomPendingFollowup | null", "RoomRuntime effects carry pending follow-up");

const createFollowup = sliceFunction(main, "createDirectorPendingFollowup");
mustIncludeIn(createFollowup, 'mode: "one_shot"', "Director follow-up is finite by default");
mustIncludeIn(createFollowup, "targetRoleId", "Director follow-up can target a concrete next role");
mustIncludeIn(createFollowup, "privateDirective", "Director private directive can drive follow-up");
mustIncludeIn(createFollowup, "maxRuns: 1", "Director follow-up cannot become infinite auto-chat");

const applyDirector = sliceFunction(main, "applyRoomDirectorTurn");
mustIncludeIn(applyDirector, "const pendingFollowup = createDirectorPendingFollowup(result)", "Director apply path creates executable follow-up");
mustIncludeIn(applyDirector, "pendingFollowup: null", "Director wait path clears pending follow-up");
mustIncludeIn(applyDirector, "canContinueWithoutPublicText", "Blocked stale public text can still continue safe follow-up");

const timerAction = sliceFunction(main, "directorFollowupTimerAction");
mustIncludeIn(timerAction, '"clear_wait_user"', "Director choice/pause waits for user");
mustIncludeIn(timerAction, '"schedule_once"', "Director executable follow-up schedules one-shot continuation");

const applyEffect = sliceFunction(main, "applyRoomRuntimeEffect");
mustIncludeIn(applyEffect, 'effect.nextTimerAction === "schedule_once"', "RoomRuntime effect handles one-shot follow-up");
mustIncludeIn(applyEffect, 'effect.nextTimerAction === "schedule_continuous"', "RoomRuntime effect handles continuous follow-up");
mustIncludeIn(applyEffect, "canScheduleRoomRuntimeFollowup(effect.pendingFollowup)", "follow-up scheduling checks pending state");
mustIncludeIn(applyEffect, 'primeRoomAutoTimer("director_followup", false, pending)', "follow-up timer receives executable pending state");
mustIncludeIn(applyEffect, '"clear_wait_user"', "wait-user action clears timer and pending state");

const canSchedule = sliceFunction(main, "canScheduleRoomRuntimeFollowup");
mustIncludeIn(canSchedule, 'pendingFollowup?.mode === "one_shot"', "manual rooms can execute explicit one-shot follow-up");
mustIncludeIn(canSchedule, "consoleState.room.autoChat", "continuous scheduling still respects room auto-chat state");

const syncTimer = sliceFunction(main, "syncRoomAutoTimer");
mustIncludeIn(syncTimer, "hasRunnableRoomAutoWork()", "timer sync delegates runnable work checks");

const runnableWork = sliceFunction(main, "hasRunnableRoomAutoWork");
mustIncludeIn(runnableWork, "hasRunnablePendingFollowup", "runnable work checks pending follow-up");
mustIncludeIn(runnableWork, "consoleState.room.autoChat", "runnable work still includes continuous auto chat");

mustInclude(scheduler, "getRunnablePendingFollowup(room, nowMs)", "scheduler reads runnable pending follow-up");
mustInclude(scheduler, "createPendingFollowupSpeechIntent(room, pendingFollowup)", "scheduler turns pending follow-up into role intent");
mustInclude(scheduler, "!room.autoChat && !hasActivePlannedTurn && !pendingFollowup", "manual pause does not block explicit pending follow-up");
mustInclude(scheduler, "pending.privateDirective?.task", "pending private directive becomes role task");

if (failures.length) {
  console.error(`Room continuation state validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("[room-continuation-state] ok");

function sliceFunction(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  const start = match?.index ?? -1;
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const candidates = ["\nfunction ", "\nasync function ", "\ninterface "]
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
