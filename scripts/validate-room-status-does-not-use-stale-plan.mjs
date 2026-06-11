import fs from "node:fs";

const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const roomPlanDetail = sliceFunction(roomSurface, "roomPlanDetail");
const roomFlowDisplayText = sliceFunction(roomSurface, "roomFlowDisplayText");
const completeRoomDiscussionPlan = sliceFunction(main, "completeRoomDiscussionPlan");
const clearSoftRoomStatusAfterVisibleTurn = sliceFunction(main, "clearSoftRoomStatusAfterVisibleTurn");

mustInclude(roomPlanDetail, "continuousFlowActive && !shouldShowStructuredRoomPlan(room)", "continuous bypasses stale non-structured plans");
mustInclude(roomPlanDetail, "return roomFlowDisplayText(room, language)", "continuous uses flow display text");
mustInclude(roomSurface, "function shouldShowStructuredRoomPlan", "structured plan guard exists");
mustInclude(roomSurface, "isStrictDebateFlow(room)", "strict debate remains allowed to show plan steps");
mustInclude(roomFlowDisplayText, "room.autoSpeechState.status", "flow display derives from auto speech status");

mustInclude(completeRoomDiscussionPlan, "isContinuousRoomFlow(consoleState.room)", "continuous completion is handled");
mustInclude(completeRoomDiscussionPlan, "!isStrictDebateFlow(consoleState.room)", "strict flow plans are preserved");
mustInclude(completeRoomDiscussionPlan, "!isHardContinuousStopReason(reason)", "soft termination reasons are cleared");
mustInclude(completeRoomDiscussionPlan, 'type: "room.setDiscussionPlan", plan: null', "soft completed plan is cleared");

mustInclude(clearSoftRoomStatusAfterVisibleTurn, "lastTerminationReason", "visible role turn clears stale termination");
mustInclude(clearSoftRoomStatusAfterVisibleTurn, "simulation.currentFocus", "visible role turn clears stale focus");
mustInclude(main, "clearSoftRoomStatusAfterVisibleTurn();", "speaker success calls stale-state cleanup");

mustNotInclude(roomPlanDetail, 'return roomUiText(language, "autoWaitingNextTurn");\n    }\n    return room.lastTerminationReason', "no-plan branch does not always show stale queued status");

if (failures.length) {
  console.error(`Room stale status validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room stale status validation passed.");

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

function mustNotInclude(text, marker, label) {
  if (text.includes(marker)) {
    failures.push(`unexpected ${label}: ${marker}`);
  }
}
