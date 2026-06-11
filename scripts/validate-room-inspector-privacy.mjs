import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const types = read("src/core/types.ts");
const main = read("src/main.ts");

mustInclude(types, "sourceVisibility?: DirectorSourceVisibility", "inspector patches should carry source visibility");
mustInclude(types, "publicSafe?: boolean", "inspector patches should carry public safety");
mustInclude(main, "sanitizeDirectorInspectorPatchForPublic", "public inspector patch sanitizer should exist");
mustInclude(main, "currentFocus: _currentFocus", "sanitizer should strip private current focus");
mustInclude(main, "nextPressure: _nextPressure", "sanitizer should strip private next pressure");
mustInclude(main, "lastTurnOutcome: _lastTurnOutcome", "sanitizer should strip private last ruling");
mustInclude(main, "situationAssessment: _situationAssessment", "sanitizer should strip private situation assessment");
mustInclude(main, "sanitizeDirectorSimulationPatchForPublic", "public simulation patch sanitizer should exist");
mustInclude(main, "delete safePatch.currentFocus", "simulation sanitizer should strip private current focus");
mustInclude(main, "delete safePatch.nextPressure", "simulation sanitizer should strip private next pressure");
mustInclude(main, "delete safePatch.lastRuling", "simulation sanitizer should strip private ruling");
mustInclude(main, "delete safePatch.situationAssessment", "simulation sanitizer should strip private assessment");
mustInclude(main, "sanitizeDirectorInspectorPatchForPublic(result.inspectorPatch", "director schedule results should use inspector sanitizer");
mustInclude(main, "sanitizeDirectorInspectorPatchForPublic(tick.inspectorPatch", "director tick results should use inspector sanitizer");
mustInclude(main, "sanitizeDirectorSimulationPatchForPublic(result.simulation", "director schedule results should sanitize simulation state");
mustInclude(main, "sanitizeDirectorSimulationPatchForPublic(tick.sceneStatePatch", "director tick results should sanitize scene state");

if (failures.length > 0) {
  console.error(`validate-room-inspector-privacy failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-room-inspector-privacy passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}
