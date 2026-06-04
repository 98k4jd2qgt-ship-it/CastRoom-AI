import fs from "node:fs";

const failures = [];

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const main = fs.readFileSync("src/main.ts", "utf8");
const recordStart = main.indexOf("function recordAppMemoryEvent");
const recordEnd = main.indexOf("\nfunction persistAppState", recordStart);
const recordBlock = recordStart >= 0 && recordEnd > recordStart ? main.slice(recordStart, recordEnd) : "";

expect(recordBlock.includes("Memory.write.saved"), "recordAppMemoryEvent should record a diagnostic for successful memory writes");
expect(recordBlock.includes("graphSync"), "memory write diagnostic should expose graph sync state");
expect(recordBlock.includes("graphNotify"), "memory write diagnostic should expose whether Memory UI refresh was requested");
expect(recordBlock.includes("!canUseTauriCommands()"), "memory write should locally notify Memory UI when graph persistence is unavailable");
expect(recordBlock.includes("notifyMemoryDashboardUpdated()"), "memory write should trigger Memory dashboard local refresh");
expect(!recordBlock.includes("requestRender("), "recordAppMemoryEvent should not full-render after memory writes");

const persistBlockStart = main.indexOf("function persistProjectRuntimeMemoryGraphScopes");
const persistBlockEnd = main.indexOf("\nasync function loadProjectRuntimeMemoryScopes", persistBlockStart);
const persistBlock = persistBlockStart >= 0 && persistBlockEnd > persistBlockStart ? main.slice(persistBlockStart, persistBlockEnd) : "";

expect(persistBlock.includes("if (options.replace)"), "graph persistence should only delete scopes in explicit replace mode");
expect(!/await memoryGraphRepository\.deleteScope\(scope\);\s*for \(const claim of memoryStore\.listGraphClaimInputs\(scope\)\)/s.test(persistBlock), "normal graph sync should not delete a scope before merging claims");

if (failures.length > 0) {
  console.error(`Memory write UI refresh validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory write UI refresh validation passed.");
