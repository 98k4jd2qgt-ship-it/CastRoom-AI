import fs from "node:fs";

const failures = [];
const main = fs.readFileSync("src/main.ts", "utf8");

const ensureRoomAutoProgress = sliceFunction(main, "ensureRoomAutoProgress");
const ensureContinuousRoomAutoTimer = sliceFunction(main, "ensureContinuousRoomAutoTimer");
const notifyRoomSurfaceUpdated = sliceFunction(main, "notifyRoomSurfaceUpdated");
const notifyRoomInspectorUpdated = sliceFunction(main, "notifyRoomInspectorUpdated");
const applyRoomRuntimeResult = sliceFunction(main, "applyRoomRuntimeResult");
const render = sliceFunction(main, "render");

mustInclude(ensureRoomAutoProgress, 'consoleState.room.advancePolicy !== "continuous"', "watchdog is scoped to continuous Room Flow");
mustInclude(ensureRoomAutoProgress, 'autoSpeechState.status === "waiting_user"', "watchdog converts soft waiting_user states back into queued continuous flow");
mustInclude(ensureRoomAutoProgress, "convert_waiting_user_to_queue", "watchdog records waiting_user recovery");
mustInclude(ensureRoomAutoProgress, 'autoSpeechState.status !== "cooling_down" && autoSpeechState.status !== "running"', "watchdog only repairs queued/running continuous turns after waiting_user recovery");
mustInclude(ensureRoomAutoProgress, "!autoSpeechState.nextTurnAt", "watchdog repairs missing nextTurnAt");
mustInclude(ensureRoomAutoProgress, "primeRoomAutoTimer(", "watchdog primes missing queued turns");
mustInclude(ensureRoomAutoProgress, "autoSpeechState.nextTurnAt <= Date.now()", "watchdog detects overdue queued turns");
mustInclude(ensureRoomAutoProgress, "!roomAutoTimer || overdue", "watchdog repairs missing timers and overdue timers");
mustInclude(ensureRoomAutoProgress, "syncRoomAutoTimer()", "watchdog resyncs timer dispatch");
mustInclude(ensureRoomAutoProgress, "sync_overdue_next_turn", "watchdog records overdue timer recovery");
mustInclude(ensureRoomAutoProgress, "sync_missing_timer", "watchdog records missing timer recovery");

mustInclude(ensureContinuousRoomAutoTimer, "ensureRoomAutoProgress(reason)", "legacy watchdog wrapper delegates to unified helper");
mustNotInclude(notifyRoomSurfaceUpdated, "ensureRoomAutoProgress", "message local updates do not create render/watchdog feedback loops");
mustNotInclude(notifyRoomInspectorUpdated, "ensureRoomAutoProgress", "inspector local updates do not create render/watchdog feedback loops");
mustInclude(applyRoomRuntimeResult, 'ensureRoomAutoProgress("runtime_result")', "runtime results repair lost continuous timers");
mustNotInclude(render, 'ensureRoomAutoProgress("room_render")', "full room render does not create render/watchdog feedback loops");

if (failures.length) {
  console.error(`Room auto timer watchdog validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room auto timer watchdog validation passed.");

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

function sliceFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start === -1) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, nextFunction === -1 ? source.length : nextFunction);
}
