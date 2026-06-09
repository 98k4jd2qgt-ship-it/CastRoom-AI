import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const types = read("src/core/types.ts");
const scheduler = read("src/core/roomScheduler.ts");
const appState = read("src/core/appState.ts");
const roomSurface = read("src/ui/roomSurface.ts");

mustInclude(types, "export type DirectorSourceVisibility", "types should define Director source visibility");
mustInclude(types, "export type DirectorScriptPublicSafety", "types should define Director script public safety");
mustInclude(types, "sourceVisibility?: DirectorSourceVisibility", "script item should preserve source visibility");
mustInclude(types, "sourceMessageIds?: string[]", "script item should preserve source message ids");
mustInclude(types, "publicSafety?: DirectorScriptPublicSafety", "script item should preserve public safety");
mustInclude(appState, "sourceVisibility:", "script normalization/defaults should preserve source visibility");
mustInclude(appState, "publicSafety:", "script normalization/defaults should preserve public safety");
mustInclude(scheduler, "classifyMessageSourceVisibility", "scheduler should classify source visibility");
mustInclude(scheduler, "activePublicDirectorScriptTexts", "public narration should use public-safe script text");
mustInclude(scheduler, "isPublicSafeDirectorScriptItem", "scheduler should filter script items by public safety");
mustInclude(scheduler, 'publicSafety: "private_blocked"', "private/director-only sources should be blocked for public use");
mustInclude(roomSurface, "directorScriptItemSafetyLabels", "UI should show script source safety badges");

if (failures.length > 0) {
  console.error(`validate-director-script-source-visibility failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-script-source-visibility passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}
