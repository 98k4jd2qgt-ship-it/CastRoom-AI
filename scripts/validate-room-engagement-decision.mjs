import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const types = fs.readFileSync(path.join(root, "src/core/types.ts"), "utf8");
const scheduler = fs.readFileSync(path.join(root, "src/core/roomScheduler.ts"), "utf8");
const appState = fs.readFileSync(path.join(root, "src/core/appState.ts"), "utf8");
const roomSurface = fs.readFileSync(path.join(root, "src/ui/roomSurface.ts"), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(types.includes('RoomEngagementDecisionKind = "required" | "optional" | "silent_allowed" | "blocked"'), "RoomEngagementDecisionKind must define required/optional/silent_allowed/blocked.");
assert(types.includes("export interface RoomEngagementDecision"), "RoomEngagementDecision type is missing.");
assert(types.includes("export interface RoomShouldSpeakDecision"), "RoomShouldSpeakDecision type is missing.");
assert(types.includes("export interface RoomInputProcessedRecord"), "RoomInputProcessedRecord type is missing.");

assert(scheduler.includes("function resolveEngagementDecision("), "resolveEngagementDecision helper must exist.");
assert(scheduler.includes("function buildShouldSpeakDecision("), "buildShouldSpeakDecision helper must exist.");
assert(scheduler.includes("function recordInputProcessed("), "recordInputProcessed helper must exist.");
assert(scheduler.includes("engagementDecision: engagementDecision ?? undefined"), "RoomScheduleResult must carry engagementDecision.");
assert(scheduler.includes("shouldSpeakDecision: shouldSpeakDecision ?? undefined"), "RoomScheduleResult must carry shouldSpeakDecision.");
assert(scheduler.includes("inputProcessedRecord"), "RoomScheduleResult must carry inputProcessedRecord.");

assert(appState.includes("lastEngagementDecision: null"), "RoomState initialization must include lastEngagementDecision.");
assert(appState.includes("lastShouldSpeakDecision: null"), "RoomState initialization must include lastShouldSpeakDecision.");
assert(appState.includes("lastInputProcessed: null"), "RoomState initialization must include lastInputProcessed.");
assert(appState.includes("action.engagementDecision === undefined"), "Reducer must preserve/update engagementDecision.");
assert(appState.includes("action.shouldSpeakDecision === undefined"), "Reducer must preserve/update shouldSpeakDecision.");
assert(appState.includes("action.inputProcessed === undefined"), "Reducer must preserve/update inputProcessed.");

assert(roomSurface.includes("lastEngagementDecision"), "Inspector must expose recent engagement decision.");
assert(roomSurface.includes("lastShouldSpeakDecision"), "Inspector must expose recent should-speak decision.");

console.log("Room engagement decision validation passed.");
