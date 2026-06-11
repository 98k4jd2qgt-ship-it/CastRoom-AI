import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const scheduler = read("src/core/roomScheduler.ts");

mustInclude(
  scheduler,
  "function containsDirectorBackstageLeakText",
  "scheduler should have a dedicated backstage/state-dump public output gate",
);
mustInclude(
  scheduler,
  "Current\\s+scene",
  "public output gate should recognize English state dump text",
);
mustInclude(
  scheduler,
  "\\u5f53\\u524d\\u573a\\u666f",
  "public output gate should recognize Chinese state dump text",
);
mustInclude(
  scheduler,
  "Follow\\s+up\\s+on",
  "public output gate should recognize leaked follow-up clues",
);
mustInclude(
  scheduler,
  "Developer\\s+Director\\s+Channel",
  "public output gate should recognize Director Channel text",
);
mustInclude(
  scheduler,
  "attempted\\s+action",
  "public output gate should recognize generic attempted-action status text",
);
mustInclude(
  scheduler,
  "needs\\s+a\\s+clear\\s+ruling",
  "public output gate should recognize generic needs-ruling status text",
);
mustInclude(
  scheduler,
  "User\\s+input\\s+remains\\s+optional",
  "public output gate should recognize user-wait status text",
);
mustInclude(
  scheduler,
  "continue\\s+through\\s+role\\s+flow",
  "public output gate should recognize role-flow status text",
);
mustNotInclude(
  scheduler,
  "The attempted action changes the room's attention",
  "Director public narration must not use generic attempted-action status text",
);
mustNotInclude(
  scheduler,
  'Current scene: ${room.director.sceneBoard.currentScene',
  "createDirectorPlanText must not publish scene-board state summaries",
);
mustNotInclude(
  scheduler,
  "Open clues: ${clues}",
  "createDirectorPlanText must not publish open-clue debug summaries",
);
mustInclude(
  scheduler,
  "extractExplicitPublicNarrationBody(userInput)",
  "explicit public narration should use a dedicated body extraction path",
);
mustInclude(
  scheduler,
  "!isDirectorChannelSourceText(userInput)",
  "Director Channel source text should not become public open clues",
);
mustInclude(
  scheduler,
  "activePublicDirectorScriptTexts",
  "public script reading should keep a filtered public-safe path",
);

if (failures.length > 0) {
  console.error(`validate-director-public-narration-no-state-dump failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-public-narration-no-state-dump passed");

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
    failures.push(`${label}: still contains ${marker}`);
  }
}
