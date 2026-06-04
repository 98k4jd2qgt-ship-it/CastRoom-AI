import fs from "node:fs";

const types = fs.readFileSync("src/core/types.ts", "utf8");
const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const appState = fs.readFileSync("src/core/appState.ts", "utf8");
const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const copy = fs.readFileSync("src/ui/copy.ts", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");
const failures = [];

mustInclude(types, 'export type RoomAdvancePolicy = "wait_for_instruction" | "fill_gap" | "continuous"', "advance policy type");
mustInclude(types, "export type RoomBlockingNeed =", "blocking need type");
mustInclude(types, "export interface ContinuationAssessment", "continuation assessment type");
mustInclude(types, "export interface RoomAdvanceDecision", "advance decision type");
mustInclude(types, "advancePolicy?: RoomAdvancePolicy", "room advance policy state");
mustInclude(types, "lastContinuationAssessment?: ContinuationAssessment | null", "room continuation state");
mustInclude(types, "lastAdvanceDecision?: RoomAdvanceDecision | null", "room advance decision state");
mustInclude(types, 'type: "room.setAdvancePolicy"', "advance policy action");

mustInclude(appState, 'defaultRoomAdvancePolicy: RoomAdvancePolicy = "fill_gap"', "fill gap default policy");
mustInclude(appState, "advancePolicy: defaultRoomAdvancePolicy", "default room stores policy");
mustInclude(appState, 'case "room.setAdvancePolicy"', "advance policy reducer");
mustInclude(appState, 'case "room.setAdvanceRuntimeState"', "advance runtime reducer");

mustInclude(scheduler, "export function resolveContinuationAssessment", "continuation resolver");
mustInclude(scheduler, "export function resolveAdvanceDecision", "advance decision resolver");
mustInclude(scheduler, "export function buildAutonomousContinuation", "autonomous continuation helper");
mustInclude(scheduler, 'policy === "fill_gap"', "fill gap decision branch");
mustInclude(scheduler, 'policy === "wait_for_instruction"', "wait policy branch");
mustInclude(scheduler, 'policy === "continuous"', "continuous policy type is referenced");

mustInclude(roomSurface, "renderRoomAdvancePolicyControl", "Room Inspector advance control");
mustInclude(roomSurface, 'type: "room.setAdvancePolicy"', "Room UI dispatches policy action");
mustInclude(roomSurface, "room.lastContinuationAssessment", "Room UI shows continuation assessment");
mustInclude(roomSurface, "room.lastAdvanceDecision", "Room UI shows advance decision");
mustInclude(styles, ".room-advance-segmented", "advance segmented style");
mustInclude(styles, ".room-advance-option[data-active=\"true\"]", "active advance option style");

for (const key of [
  "advancePolicy_wait_for_instruction",
  "advancePolicy_fill_gap",
  "advancePolicy_continuous",
  "advanceBlockingNeed",
  "advanceDecision_fill_gap",
]) {
  mustInclude(copy, key, `copy key ${key}`);
}

if (failures.length) {
  console.error(`Room advance policy validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room advance policy validation passed.");

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}
