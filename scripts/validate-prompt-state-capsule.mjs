import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(message) {
  failures.push(message);
}

function requireIncludes(label, text, patterns) {
  for (const pattern of patterns) {
    if (!text.includes(pattern)) {
      fail(`${label} is missing: ${pattern}`);
    }
  }
}

const prompts = read("src/core/prompts.ts");
const main = read("src/main.ts");

requireIncludes("State capsule", prompts, [
  "export function buildRoomStateCapsule",
  "Pending follow-up:",
  "Situation: phase=",
  "Debate state: phase=",
  "Simulation: phase=",
  "Plot: phase=",
  "spoken=",
  "deferredVerdict=",
]);

requireIncludes("Director task card", prompts, [
  "export function buildDirectorTaskCard",
  "Move:",
  "Public text reason:",
  "Wait for user:",
  "Next speaker:",
  "Private directives:",
  "Do not restart setup, reschedule completed speakers, reveal private directives, or describe backend judgement.",
]);

requireIncludes("Role task card", prompts, [
  "export function buildRoleTaskCard",
  "Speaker:",
  "Mode task:",
  "Turn goal:",
  "Private task:",
  "Do not:",
  "Speak or act directly for this turn.",
]);

requireIncludes("Memory and guard capsules", prompts, [
  "export function buildPromptMemoryCapsule",
  "export function buildPromptGuardFeedback",
  "Last stop reason:",
  "Simulation stop reason:",
  "Recent blockers:",
  "Debate has already started. Do not restart setup unless the user explicitly resets the room.",
  "Debate verdict is due. Do not assign another required speaker for the completed round.",
]);

requireIncludes("Runtime task-card injection", main, [
  "Task card:",
  "buildDirectorTaskCard(localPlan",
  "buildRoleTaskCard(",
  "forbiddenMoves:",
]);

if (failures.length > 0) {
  console.error("Prompt state capsule validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Prompt state capsule validation passed.");
