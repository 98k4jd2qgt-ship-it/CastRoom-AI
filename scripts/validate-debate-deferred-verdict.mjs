import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[debate-deferred-verdict] ${message}`);
    process.exitCode = 1;
  }
}

const debate = read("src/core/debatePolicy.ts");
const directorPolicy = read("src/core/directorModePolicy.ts");
const guards = read("src/core/roomRuleGuards.ts");

assert(debate.includes("export function isDebateDeferredVerdictRequest"), "debatePolicy must expose isDebateDeferredVerdictRequest");
assert(debate.includes("isDebateDeferredVerdictRequest(room, text)"), "immediate verdict detection must exclude deferred verdict requests");
assert(
  !/function isDebateSetupRequest[\s\S]{0,260}isDebateVerdictRequest\(room, text\)[\s\S]{0,80}return false/.test(debate),
  "debate setup must not be rejected only because the same input contains a future verdict request",
);
assert(
  directorPolicy.indexOf("isDebateSetupRequest(room, text)") < directorPolicy.indexOf("isDebateVerdictRequest(room, text)"),
  "Director debate setup handling must run before immediate verdict handling",
);
assert(
  directorPolicy.includes("hasDeferredVerdict") && directorPolicy.includes("record the later verdict request"),
  "Director policy must preserve deferred verdict as a later requirement",
);
assert(
  guards.includes('"final_verdict"') && guards.includes("all_relevant_speakers_done"),
  "Frame interpretation must create a deferred final_verdict requirement",
);

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[debate-deferred-verdict] ok");
