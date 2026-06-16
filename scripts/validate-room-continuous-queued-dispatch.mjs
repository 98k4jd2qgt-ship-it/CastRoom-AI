import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");

mustInclude(main, "function ensureRoomAutoProgress", "continuous auto flow should have a watchdog");
mustInclude(main, "function scheduleImmediateRoomAutoTurn", "continuous auto flow should support immediate overdue dispatch");
mustInclude(main, "nextTurnAt <= Date.now()", "watchdog should immediately dispatch overdue queued turns");
mustInclude(main, "scheduleImmediateRoomAutoTurn(reason)", "overdue queued turns should not only resync a timer");
mustInclude(main, "dispatch_overdue_next_turn", "overdue queued dispatch should be diagnosed");
mustInclude(main, "void runRoomAutoTurn()", "overdue queued dispatch should call the auto turn runner");
mustInclude(main, "!roomAutoTimer", "watchdog should repair missing timers");
mustInclude(main, "function startRoomAutoWatchdog", "continuous auto flow should run an independent watchdog");
mustInclude(main, "watchdog_interval", "watchdog interval should repair silent queued states");
mustInclude(main, "missing_timer", "watchdog diagnostics should include missing timer recovery");
mustInclude(main, "missing_next_turn", "watchdog should repair queued states without nextTurnAt");
mustInclude(main, "active_room_runtime", "runtime busy should be treated as a queued retry path");
mustInclude(main, "continuousRuntimeBusy", "continuous runtime busy should have a dedicated retry branch");
mustInclude(main, "runtime_busy_retry_queued", "continuous runtime busy should be diagnosed as a queued retry");
mustInclude(main, "{ delayMs: 250 }", "continuous runtime busy should schedule a short retry instead of only syncing an existing timer");
mustInclude(main, "effect.nextTimerAction === \"clear\" && isContinuousRoomFlow(consoleState.room)", "continuous flow should not accept bare timer clear effects");
mustInclude(main, "runtime_clear_in_continuous", "continuous timer clear recovery should be diagnosed");
mustInclude(main, "reprime_clear_action", "continuous timer clear recovery should re-prime the queue");
mustInclude(main, "primeRoomAutoTimer(\"director_followup\"", "continuous clear recovery should schedule another turn");
mustInclude(main, "function recoverContinuousScheduleStop", "continuous soft stop schedule results should be recovered by the flow driver");
mustInclude(main, "recover_soft_stop", "continuous soft stop recovery should be diagnosed");
mustInclude(main, "recoverContinuousScheduleStop(result, \"schedule_result_stop\")", "schedule stop branch should recover soft continuous stops before plain timer sync");
mustInclude(main, "sync_queued_soft_stop", "soft stop recovery should repair real queued turns instead of ignoring them");
mustInclude(main, "soft_blocked_to_queue", "watchdog should recover soft blocked continuous states");
mustInclude(main, "isHardContinuousStopReason(result.reason)", "soft stop recovery should preserve hard blockers");

if (failures.length > 0) {
  console.error(`validate-room-continuous-queued-dispatch failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-room-continuous-queued-dispatch passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}
