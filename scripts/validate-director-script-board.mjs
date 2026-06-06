import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const types = read("src/core/types.ts");
const appState = read("src/core/appState.ts");
const scheduler = read("src/core/roomScheduler.ts");
const roomSurface = read("src/ui/roomSurface.ts");

mustInclude(types, "export interface DirectorScriptBoard", "Director script board type should exist");
mustInclude(types, "scriptBoard: DirectorScriptBoard", "RoomDirectorState should own script board");
mustInclude(appState, "createDefaultDirectorScriptBoard", "default room state should create script board");
mustInclude(appState, "normalizeDirectorScriptBoard", "runtime normalization should restore script board for old rooms");
mustInclude(appState, 'case "room.updateDirectorScript"', "reducer should support script board patches");
mustInclude(scheduler, "createDirectorTickScriptPatch", "Director tick should update script board");
mustInclude(roomSurface, "directorScriptBoard", "developer inspector should show Director script summary");

if (failures.length > 0) {
  console.error(`validate-director-script-board failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-script-board passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}
