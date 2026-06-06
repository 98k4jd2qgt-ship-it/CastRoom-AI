import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const types = read("src/core/types.ts");
const appState = read("src/core/appState.ts");
const main = read("src/main.ts");
const roomSurface = read("src/ui/roomSurface.ts");

mustInclude(types, 'visibility: "director_only"', "script board items should be director-only");
mustInclude(appState, 'visibility: "director_only"', "normalization should force director-only script visibility");
mustInclude(main, 'visibility: "director_channel"', "script/tick backstage notes should stay in Director channel");
mustInclude(main, 'channelId: "director"', "script/tick backstage notes should target Director channel");
mustInclude(roomSurface, 'room.freedomLevel === "developer" || activeChannel.type === "director"', "script board UI should only show to developer/director views");
mustNotInclude(main, "scriptBoard.hiddenFacts.map", "hidden script facts should not be injected into public prompt assembly in main");

if (failures.length > 0) {
  console.error(`validate-director-script-privacy failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-script-privacy passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}

function mustNotInclude(text, marker, label) {
  if (text.includes(marker)) {
    failures.push(`${label}: unexpected ${marker}`);
  }
}
