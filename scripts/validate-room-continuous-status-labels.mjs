import fs from "node:fs";

const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const appState = fs.readFileSync("src/core/appState.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const roomTopbarSummary = sliceFunction(roomSurface, "roomTopbarSummary");
const autoSpeechStatusLabel = sliceFunction(roomSurface, "autoSpeechStatusLabel");
const roomPlanDetail = sliceFunction(roomSurface, "roomPlanDetail");
const isHardContinuousUiStopReason = sliceFunction(roomSurface, "isHardContinuousUiStopReason");
const toggleAutoChatBlock = sliceBetween(appState, 'case "room.toggleAutoChat":', 'case "room.setPrivateWhispers":');
const applyRoomRuntimeResult = sliceFunction(main, "applyRoomRuntimeResult");

mustInclude(roomTopbarSummary, 'room.isOpen && room.autoChat && room.advancePolicy === "continuous"', "topbar detects active continuous flow");
mustInclude(roomTopbarSummary, "continuousFlowActive || room.autoSpeechState.status", "topbar treats continuous soft waiting as running");
mustInclude(autoSpeechStatusLabel, 'room.isOpen && room.autoChat && room.advancePolicy === "continuous" && room.autoSpeechState.status === "waiting_user"', "auto label overrides stale waiting_user in continuous");
mustInclude(autoSpeechStatusLabel, 'return t(language, "roomAutoRunning")', "auto label reports running for continuous stale wait");

mustInclude(roomPlanDetail, 'room.isOpen && room.autoChat && room.advancePolicy === "continuous"', "plan detail detects active continuous flow");
mustInclude(roomPlanDetail, "!isHardContinuousUiStopReason(plan.lastStopReason)", "plan detail hides soft stopped reasons in continuous");
mustInclude(isHardContinuousUiStopReason, 'reason === "model_unavailable"', "model unavailable remains visible as hard stop");
mustInclude(isHardContinuousUiStopReason, 'reason === "private_leak_blocked"', "private leak remains visible as hard stop");
mustInclude(isHardContinuousUiStopReason, 'reason === "budget_limit"', "budget limit remains visible as hard stop");

mustNotInclude(toggleAutoChatBlock, 'stopReason: state.room.autoChat ? "waiting_user"', "manual pause does not write waiting_user stop reason");
mustInclude(applyRoomRuntimeResult, 'result.reason === "active_room_runtime"', "runtime active-operation branch is handled");
mustInclude(applyRoomRuntimeResult, 'continuousFlowActive ? undefined : "waiting_user"', "continuous active-operation branch does not write waiting_user");
mustInclude(applyRoomRuntimeResult, '? "sync"', "continuous active-operation branch syncs the timer");
mustInclude(applyRoomRuntimeResult, 'ensureRoomAutoProgress("runtime_result")', "runtime result runs continuous timer watchdog");

if (failures.length) {
  console.error(`Room continuous status label validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room continuous status label validation passed.");

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
