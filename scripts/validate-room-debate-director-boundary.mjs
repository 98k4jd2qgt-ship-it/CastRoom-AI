import fs from "node:fs";

const debatePolicy = fs.readFileSync("src/core/debatePolicy.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

mustInclude(debatePolicy, "不要主持比赛");
mustInclude(debatePolicy, "Do not host");
mustInclude(main, "Strict debate step");
mustInclude(main, "Strict debate task");
mustInclude(main, "consoleState.room.match.debateFlow?.motion || consoleState.room.match.motion");
mustInclude(main, "strictDebateFlowTurnTask(consoleState.room");
mustInclude(debatePolicy, "isDebateFinalVerdictDue");

if (failures.length > 0) {
  console.error("validate-room-debate-director-boundary failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-room-debate-director-boundary passed");

function mustInclude(source, marker) {
  if (!source.includes(marker)) {
    failures.push(`missing marker: ${marker}`);
  }
}
