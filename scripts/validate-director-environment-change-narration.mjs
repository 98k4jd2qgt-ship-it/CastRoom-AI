import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const types = read("src/core/types.ts");
const scheduler = read("src/core/roomScheduler.ts");
const appState = read("src/core/appState.ts");

mustInclude(types, "environmentAnchors: DirectorScriptItem[]", "script board should expose environment anchors");
mustInclude(appState, "environmentAnchors:", "default and normalized script board should preserve environment anchors");
mustInclude(scheduler, "activeDirectorScriptTexts(room.director.scriptBoard.environmentAnchors)", "Director tick should read environment anchors");
mustInclude(scheduler, 'return "environment_change"', "Director tick should trigger environment change narration");
mustInclude(scheduler, 'case "environment_change"', "Director tick should render environment change narration");

if (failures.length > 0) {
  console.error(`validate-director-environment-change-narration failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-environment-change-narration passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}
