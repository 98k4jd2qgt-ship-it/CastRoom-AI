import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[director-situation-assessment] ${message}`);
    process.exitCode = 1;
  }
}

const types = read("src/core/types.ts");
const scheduler = read("src/core/roomScheduler.ts");
const debate = read("src/core/debatePolicy.ts");
const appState = read("src/core/appState.ts");

assert(types.includes("RoomDebateLifecyclePhase"), "Room match state must expose a debate lifecycle phase");
assert(types.includes("spokenRoleIdsByRound"), "Room match state must record spoken speaker ids by round");
assert(types.includes("deferredRequirements"), "Room match state must preserve deferred debate requirements");
assert(appState.includes("debatePhase: \"setup_pending\""), "Default match state must initialize debate lifecycle safely");
assert(appState.includes("spokenRoleIdsByRound"), "App state normalization must preserve spoken speaker progress");

for (const marker of [
  "export function debateLifecyclePhase",
  "export function debateMaterialStats",
  "export function isDebateFinalVerdictDue",
  "requiredDebateSpeakerAssignments",
]) {
  assert(debate.includes(marker), `debatePolicy missing lifecycle helper ${marker}`);
}

assert(
  scheduler.includes("createSituationAssessment") && scheduler.includes("debateLifecyclePhase(room)"),
  "Situation assessment must use debate lifecycle phase instead of only raw round/currentSide",
);
assert(
  scheduler.includes("all required debate speakers have spoken and a deferred verdict is due"),
  "Situation assessment must explain verdict_due state in Inspector diagnostics",
);
assert(
  scheduler.includes("debateMaterialStats(room)") && scheduler.includes('return "strong";'),
  "Debate material sufficiency must be derived from debate progress and material stats",
);

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[director-situation-assessment] ok");
