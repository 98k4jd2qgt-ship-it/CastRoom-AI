import fs from "node:fs";

const failures = [];
const main = fs.readFileSync("src/main.ts", "utf8");

const ensureRoomAutoProgress = sliceFunction(main, "ensureRoomAutoProgress");
const ensureContinuousRoomAutoTimer = sliceFunction(main, "ensureContinuousRoomAutoTimer");
const scheduleImmediateRoomAutoTurn = sliceFunction(main, "scheduleImmediateRoomAutoTurn");
const startRoomAutoWatchdog = sliceFunction(main, "startRoomAutoWatchdog");
const syncRoomAutoTimer = sliceFunction(main, "syncRoomAutoTimer");
const clearRoomAutoScheduledTimer = sliceFunction(main, "clearRoomAutoScheduledTimer");
const clearRoomAutoTimer = sliceFunction(main, "clearRoomAutoTimer");
const notifyRoomSurfaceUpdated = sliceFunction(main, "notifyRoomSurfaceUpdated");
const notifyRoomInspectorUpdated = sliceFunction(main, "notifyRoomInspectorUpdated");
const applyRoomRuntimeResult = sliceFunction(main, "applyRoomRuntimeResult");
const requestRender = sliceFunction(main, "requestRender");
const render = sliceFunction(main, "render");

mustInclude(ensureRoomAutoProgress, 'consoleState.room.advancePolicy !== "continuous"', "watchdog is scoped to continuous Room Flow");
mustInclude(ensureRoomAutoProgress, 'autoSpeechState.status === "waiting_user"', "watchdog converts soft waiting_user states back into queued continuous flow");
mustInclude(ensureRoomAutoProgress, "convert_waiting_user_to_queue", "watchdog records waiting_user recovery");
mustInclude(ensureRoomAutoProgress, 'autoSpeechState.status === "paused"', "watchdog recovers soft paused continuous states");
mustInclude(ensureRoomAutoProgress, "recover_soft_paused_queue", "watchdog records soft paused recovery");
mustInclude(ensureRoomAutoProgress, 'autoSpeechState.status !== "cooling_down" && autoSpeechState.status !== "running"', "watchdog only repairs queued/running continuous turns after waiting_user recovery");
mustInclude(ensureRoomAutoProgress, "!autoSpeechState.nextTurnAt", "watchdog repairs missing nextTurnAt");
mustInclude(ensureRoomAutoProgress, "primeRoomAutoTimer(", "watchdog primes missing queued turns");
mustInclude(ensureRoomAutoProgress, "autoSpeechState.nextTurnAt <= Date.now()", "watchdog detects overdue queued turns");
mustInclude(ensureRoomAutoProgress, "reset_stale_immediate_dispatch", "watchdog repairs stale immediate dispatch timers");
mustInclude(ensureRoomAutoProgress, "scheduleImmediateRoomAutoTurn(reason)", "watchdog directly dispatches overdue queued turns");
mustInclude(ensureRoomAutoProgress, "syncRoomAutoTimer()", "watchdog resyncs timer dispatch");
mustInclude(ensureRoomAutoProgress, "sync_overdue_next_turn", "watchdog records overdue timer recovery");
mustInclude(ensureRoomAutoProgress, "sync_missing_timer", "watchdog records missing timer recovery");

mustInclude(scheduleImmediateRoomAutoTurn, "roomAutoImmediateDispatchTimer", "immediate dispatch is guarded against duplicate timers");
mustInclude(scheduleImmediateRoomAutoTurn, "roomAutoImmediateDispatchQueuedAt = Date.now()", "immediate dispatch records queue time");
mustInclude(scheduleImmediateRoomAutoTurn, "roomAutoImmediateDispatchQueuedAt = 0", "immediate dispatch clears queue time after firing");
mustInclude(scheduleImmediateRoomAutoTurn, "void runRoomAutoTurn()", "overdue queued turns dispatch the auto turn");
mustInclude(scheduleImmediateRoomAutoTurn, "dispatch_overdue_next_turn", "immediate dispatch records a diagnostic");
mustInclude(syncRoomAutoTimer, "clearRoomAutoScheduledTimer()", "normal timer sync only clears the scheduled timer");
mustNotInclude(syncRoomAutoTimer, "window.clearTimeout(roomAutoImmediateDispatchTimer)", "normal timer sync does not cancel watchdog immediate dispatch");
mustInclude(clearRoomAutoScheduledTimer, "window.clearTimeout(roomAutoTimer)", "scheduled timer clear only clears the normal timer");
mustInclude(clearRoomAutoTimer, "window.clearTimeout(roomAutoImmediateDispatchTimer)", "clearing auto timers also cancels pending immediate dispatch");
mustInclude(clearRoomAutoTimer, "roomAutoImmediateDispatchTimer = 0", "clearing auto timers resets immediate dispatch state");
mustInclude(clearRoomAutoTimer, "roomAutoImmediateDispatchQueuedAt = 0", "clearing auto timers resets immediate dispatch queue time");
mustInclude(startRoomAutoWatchdog, "window.setInterval", "watchdog runs independently of render updates");
mustInclude(startRoomAutoWatchdog, 'ensureRoomAutoProgress("watchdog_interval")', "watchdog interval repairs silent queued states");
mustInclude(startRoomAutoWatchdog, 'ensureRoomAutoProgress("window_focus")', "watchdog repairs timers when the window regains focus");
mustInclude(startRoomAutoWatchdog, 'ensureRoomAutoProgress("visibility_visible")', "watchdog repairs timers when the app becomes visible");
mustInclude(main, "startRoomAutoWatchdog();", "watchdog is started during app bootstrap");

mustInclude(ensureContinuousRoomAutoTimer, "ensureRoomAutoProgress(reason)", "legacy watchdog wrapper delegates to unified helper");
mustNotInclude(main, "roomAutoProgressCheckTimer", "render-scoped auto progress timer was removed from the UI hot path");
mustNotInclude(main, "function queueRoomAutoProgressCheck", "render-scoped auto progress checks are not available");
mustNotInclude(requestRender, "queueRoomAutoProgressCheck", "room renders do not enqueue auto progress checks");
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
