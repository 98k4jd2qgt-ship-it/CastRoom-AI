import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");

mustInclude(main, "commitRoomTimelineMessage(message, \"room_director_tick_public_narration\")", "passive director narration must be committed to the public timeline");
mustInclude(main, "return completeDirectorNarrationBarrier(\"public_narration_committed\", tick)", "passive director narration must complete the committed barrier");
mustOrder(
  main,
  "commitRoomTimelineMessage(message, \"room_director_tick_public_narration\")",
  "return completeDirectorNarrationBarrier(\"public_narration_committed\", tick)",
  "passive narration should be committed before scheduling the next role",
);

mustInclude(main, "commitRoomTimelineMessage(message, \"room_director_public_text\")", "live director public text must be committed to the public timeline");
mustInclude(main, "Room.directorNarrationBarrier", "live director public text should record narration barrier diagnostics");
mustOrderAfter(
  main,
  "commitRoomTimelineMessage(message, \"room_director_public_text\")",
  "Room.directorNarrationBarrier",
  "live director public text should be committed before barrier completion diagnostics",
);

mustInclude(main, "return isContinuousRoomFlow(consoleState.room) && result.message ? \"schedule_continuous\" : \"sync\"", "continuous flow should requeue after a live director public message");
mustInclude(main, "tick.narrationBarrier === \"public_narration_pending\"", "blocked passive narration should still complete the barrier path");

if (failures.length > 0) {
  console.error(`validate-director-narration-before-role failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-narration-before-role passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}

function mustOrder(text, first, second, label) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  if (firstIndex === -1 || secondIndex === -1 || firstIndex > secondIndex) {
    failures.push(`${label}: expected ${first} before ${second}`);
  }
}

function mustOrderAfter(text, first, second, label) {
  const firstIndex = text.indexOf(first);
  if (firstIndex === -1) {
    failures.push(`${label}: missing ${first}`);
    return;
  }
  const secondIndex = text.indexOf(second, firstIndex + first.length);
  if (secondIndex === -1) {
    failures.push(`${label}: expected ${second} after ${first}`);
  }
}
