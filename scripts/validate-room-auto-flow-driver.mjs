import fs from "node:fs";

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const resolveRoomAutoFlowCommand = sliceFunction(scheduler, "resolveRoomAutoFlowCommand");
const isHardRoomAutoBlock = sliceFunction(scheduler, "isHardRoomAutoBlock");
const runRoomAutoTurn = sliceFunction(main, "runRoomAutoTurn");
const shouldCreateAutoRoomPlannerResult = sliceFunction(main, "shouldCreateAutoRoomPlannerResult");
const pauseRoomAutoOutsideForeground = sliceFunction(main, "pauseRoomAutoOutsideForeground");
const applyRoomRuntimeEffect = sliceFunction(main, "applyRoomRuntimeEffect");

mustInclude(scheduler, "export type RoomAutoFlowPhase", "central flow phase type");
mustInclude(scheduler, "export type RoomAutoFlowCommand", "central flow command type");
mustInclude(resolveRoomAutoFlowCommand, 'type: "hard_stop"', "flow command can hard stop");
mustInclude(resolveRoomAutoFlowCommand, 'type: "dispatch_role"', "flow command can dispatch a role");
mustInclude(resolveRoomAutoFlowCommand, 'type: "dispatch_director"', "flow command can dispatch Director");
mustInclude(resolveRoomAutoFlowCommand, 'type: "schedule_retry"', "flow command can schedule retry");

mustInclude(isHardRoomAutoBlock, 'blockingNeed === "privacy_or_safety"', "privacy/safety remains hard");
mustInclude(isHardRoomAutoBlock, 'blockingNeed === "provider_failure"', "provider failure remains hard");
mustInclude(isHardRoomAutoBlock, "isContinuousRoomFlow(room)", "continuous turns user-dependent blockers into soft blockers");

mustInclude(shouldCreateAutoRoomPlannerResult, "room.match.debateFlow?.steps.length", "strict debate flow skips cloud planner pre-pass");
mustInclude(shouldCreateAutoRoomPlannerResult, "isContinuousRoomFlow(room)", "planner gating checks continuous flow");
mustInclude(shouldCreateAutoRoomPlannerResult, 'mode === "casual"', "casual continuous can skip planner");
mustInclude(runRoomAutoTurn, "shouldCreateAutoRoomPlannerResult(consoleState.room)", "auto turn uses planner gating");
mustInclude(runRoomAutoTurn, ": null", "auto turn can run without planner result");

mustInclude(pauseRoomAutoOutsideForeground, "isContinuousRoomFlow(consoleState.room)", "foreground loss keeps continuous queued");
mustInclude(pauseRoomAutoOutsideForeground, 'status: "cooling_down"', "foreground loss does not write waiting_user for continuous");
mustInclude(applyRoomRuntimeEffect, 'effect.nextTimerAction === "clear_wait_user"', "runtime effect handles clear_wait_user");
mustInclude(applyRoomRuntimeEffect, "isContinuousRoomFlow(consoleState.room)", "clear_wait_user is overridden in continuous");
mustInclude(applyRoomRuntimeEffect, "primeRoomAutoTimer", "continuous clear_wait_user re-primes timer");

if (failures.length) {
  console.error(`Room auto flow driver validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room auto flow driver validation passed.");

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

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}
