import fs from "node:fs";

const debatePolicy = fs.readFileSync("src/core/debatePolicy.ts", "utf8");
const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const failures = [];

mustInclude(debatePolicy, "const flowStep = resolveNextDebateFlowStep(room, visibleRoleIds)");
mustInclude(debatePolicy, "strictFlowStep?.roleId");
mustInclude(debatePolicy, "nextMatch.debateFlow?.steps.length && !strictFlowStep");
mustInclude(debatePolicy, "pro-first");
mustInclude(debatePolicy, "con-first");
mustInclude(debatePolicy, "pro-second");
mustInclude(debatePolicy, "con-second");
mustInclude(debatePolicy, "pro-free");
mustInclude(debatePolicy, "con-free");
mustInclude(debatePolicy, "pro-third");
mustInclude(debatePolicy, "con-third");
mustInclude(scheduler, "resolveNextDebateSpeakerAssignment(room, Array.from(visibleRoleIds))");
mustInclude(scheduler, "resolveNextDebateSpeakerAssignment(room, visibleRoleIds)");

if (failures.length > 0) {
  console.error("validate-room-debate-speaker-order failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-room-debate-speaker-order passed");

function mustInclude(source, marker) {
  if (!source.includes(marker)) {
    failures.push(`missing marker: ${marker}`);
  }
}
