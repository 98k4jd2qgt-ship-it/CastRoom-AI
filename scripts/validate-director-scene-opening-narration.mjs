import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const types = read("src/core/types.ts");
const scheduler = read("src/core/roomScheduler.ts");
const main = read("src/main.ts");

mustInclude(types, '"scene_opening"', "Director narration triggers should include scene opening");
mustInclude(types, '"environment_change"', "Director narration triggers should include environment change");
mustInclude(scheduler, 'return "scene_opening"', "story/mystery first visible scene should allow opening narration");
mustInclude(scheduler, 'createDirectorTickNarration', "Director tick should build narration separately from scheduling");
mustInclude(main, 'commitRoomTimelineMessage(message, "room_director_tick_public_narration")', "tick narration should commit through public timeline");
mustInclude(main, "isDirectorPublicSchedulingText(publicNarration)", "tick narration should be filtered before public commit");

if (failures.length > 0) {
  console.error(`validate-director-scene-opening-narration failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-scene-opening-narration passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}
