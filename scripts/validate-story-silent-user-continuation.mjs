import fs from "node:fs";

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const failures = [];

mustInclude(scheduler, 'mode === "story"', "story mode is considered by continuation policy");
mustInclude(scheduler, 'mode === "mystery"', "mystery mode is considered by continuation policy");
mustInclude(scheduler, 'mode === "scene_play"', "scene-play collaboration mode is considered");
mustInclude(scheduler, '"Advance with a reversible cue, visible clue, or character reaction."', "story/mystery reversible default assumption");
mustInclude(scheduler, 'return "director_cue";', "story/mystery can continue with Director cue");
mustInclude(scheduler, 'blockingNeed === "soft_user_preference"', "soft user preference can be absorbed");
mustInclude(scheduler, 'policy === "fill_gap"', "fill-gap policy can continue story silence");
mustInclude(scheduler, 'policy === "wait_for_instruction"', "wait policy can still pause story silence");

if (failures.length) {
  console.error(`Story silent user continuation validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Story silent user continuation validation passed.");

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}
