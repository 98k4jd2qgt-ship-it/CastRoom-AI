import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[flexible-frame-intent] ${message}`);
    process.exitCode = 1;
  }
}

const types = read("src/core/types.ts");
const interpretation = read("src/core/inputInterpretation.ts");
const guards = read("src/core/roomRuleGuards.ts");
const directorPolicy = read("src/core/directorModePolicy.ts");
const scheduler = read("src/core/roomScheduler.ts");
const roomSurface = read("src/ui/roomSurface.ts");
const copy = read("src/ui/copy.ts");

for (const marker of [
  "export interface RoomFrameInterpretation",
  "export interface FrameIntentCandidate",
  "export interface DeferredRequirement",
  "export type IntentTimeBinding",
  "export type InputInterpretation",
  "export interface ChatActionPlan",
  "export interface RoomActionPlan",
  "export interface DirectorActionPlan",
  "export interface MemoryWritePlan",
  '"collaboration_request"',
  '"evaluation_request"',
  '"scheduling_request"',
  '"memory_request"',
  '"plot_direction"',
]) {
  assert(types.includes(marker), `types.ts missing ${marker}`);
}

for (const marker of [
  "export function interpretUserInput",
  "export function collectInputIntentCandidates",
  "export function resolveInputInterpretation",
  "MEMORY_WRITE_PATTERN",
  "MEMORY_RECALL_PATTERN",
  "DEFERRED_PATTERN",
  "SETUP_PATTERN",
  "EVALUATION_PATTERN",
  "覚えて",
  "기억",
  "merk dir",
  "запомни",
]) {
  assert(interpretation.includes(marker), `inputInterpretation.ts missing ${marker}`);
}

for (const marker of [
  "collectRoomFrameIntentCandidates",
  "resolveRoomFrameInterpretation",
  "FRAME_DEFERRED_PATTERN",
  "FRAME_SETUP_SIGNAL_PATTERN",
  "FRAME_EVALUATION_SIGNAL_PATTERN",
  "collectDeferredRequirements",
  "deferredRequirements",
]) {
  assert(guards.includes(marker), `roomRuleGuards.ts missing ${marker}`);
}

assert(
  guards.includes("collectFlexibleRoomFrameIntentCandidates") &&
    guards.includes("resolveFlexibleRoomFrameInterpretation") &&
    guards.includes("resolveFlexibleRoomFrameIntent"),
  "roomRuleGuards should delegate legacy frame APIs to the global input interpretation layer",
);

assert(
  /collectInputIntentCandidates[\s\S]{0,6200}return candidates\.sort/.test(interpretation),
  "collectInputIntentCandidates must score a candidate set before choosing the primary intent",
);

assert(
  /resolveRoomFrameIntent[\s\S]{0,220}\bresolveRoomFrameInterpretation\b/.test(guards),
  "resolveRoomFrameIntent should delegate to the richer interpretation result",
);

assert(
  /resolveDirectorModeIntent\(room: RoomState, text: string, interpretation\?: RoomFrameInterpretation\)/.test(directorPolicy),
  "resolveDirectorModeIntent must accept RoomFrameInterpretation",
);

assert(
  directorPolicy.includes("hasInterpretation") &&
    directorPolicy.includes("hasCandidate") &&
    directorPolicy.includes("!hasInterpretation && isDebateVerdictRequest"),
  "Director policy should consume interpretation candidates and only use legacy regexes as fallback",
);

assert(
  scheduler.includes("resolveRoomFrameInterpretation") && scheduler.includes("resolveDirectorModeIntent(input.room, input.userInput, frameInterpretation)"),
  "roomScheduler must build interpretation before resolving Director mode intent",
);

for (const marker of [
  "action_attempt",
  "collaboration_request",
  "evaluation_request",
  "scheduling_request",
  "memory_request",
  "plot_direction",
]) {
  assert(copy.includes(marker), `copy.ts missing ${marker}`);
}

for (const marker of [
  "frameDeferred",
  "frameAmbiguity",
]) {
  assert(roomSurface.includes(marker), `roomSurface.ts missing ${marker}`);
}

assert(
  roomSurface.includes('localizeEnum(language, "frameIntentKind"'),
  "roomSurface.ts should localize frame intent labels through copy.ts",
);

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[flexible-frame-intent] ok");
