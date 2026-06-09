import fs from "node:fs";

const debatePolicy = fs.readFileSync("src/core/debatePolicy.ts", "utf8");
const failures = [];

mustInclude("isStrictDebateSetupText");
mustInclude("parseDebateFlowSetup(userInput, roomWithMatch)");
mustInclude("extractStrictDebateMotion");
mustInclude("isStrictDebateSetupText(userInput)");
mustInclude("addDeferredFinalVerdict(room.match.deferredRequirements, userInput)");
mustInclude("buildStandardChineseDebateSteps");
mustInclude("director-opening");
mustInclude("pro-first");
mustInclude("con-first");
mustInclude("pro-second");
mustInclude("con-second");

mustMatch(/标准辩论赛|中文标准|严格赛制|辩论配置|赛制|流程|一辩|二辩|三辩|四辩/);
mustMatch(/辩题|正方|反方|affirmative|negative|motion/);

if (failures.length > 0) {
  console.error("validate-room-debate-setup-parsing failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-room-debate-setup-parsing passed");

function mustInclude(marker) {
  if (!debatePolicy.includes(marker)) {
    failures.push(`missing marker: ${marker}`);
  }
}

function mustMatch(pattern) {
  if (!pattern.test(debatePolicy)) {
    failures.push(`missing pattern: ${pattern}`);
  }
}
