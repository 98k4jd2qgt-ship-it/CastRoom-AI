import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");
const scheduler = read("src/core/roomScheduler.ts");
const types = read("src/core/types.ts");

mustInclude(types, "DirectorFlowBarrier", "Director flow barrier type should exist");
mustInclude(types, "public_narration_pending", "Director barrier should model pending public narration");
mustInclude(types, "public_narration_committed", "Director barrier should model committed public narration");
mustInclude(types, "public_narration_blocked", "Director barrier should model blocked public narration");
mustInclude(types, "narrationBarrier?: DirectorFlowBarrier", "Director tick result should carry barrier state");

mustInclude(scheduler, "barrier?: \"none\" | \"public_narration_pending\"", "auto flow command should carry director barrier metadata");
mustInclude(scheduler, "const narrationBarrier = publicNarration ? \"public_narration_pending\" : \"none\"", "director tick should mark public narration as a pending barrier");
mustInclude(scheduler, "narrationBarrier,", "director tick result should return narrationBarrier");

mustInclude(main, "type AppliedDirectorTickOutcome", "director tick application should return an explicit outcome");
mustInclude(main, "completeDirectorNarrationBarrier", "public narration should complete a barrier path");
mustInclude(main, "Room.directorNarrationBarrier", "director barrier diagnostics should be recorded");
mustInclude(main, "status: \"cooling_down\"", "director barrier should requeue continuous flow instead of waiting for the user");
mustInclude(main, "syncRoomAutoTimer()", "director barrier should resync the auto timer");
mustInclude(main, "public_narration_blocked", "blocked narration should be represented explicitly");

if (failures.length > 0) {
  console.error(`validate-director-narration-barrier failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-narration-barrier passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}
