import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

mustInclude("src/core/types.ts", [
  "RoomDebateFlow",
  "RoomDebateFlowStep",
  "RoomDebateFlowStepType",
  "debateFlow?: RoomDebateFlow",
  "currentStepIndex",
  "completedStepIds",
]);

mustInclude("src/core/debatePolicy.ts", [
  "parseDebateFlowSetup",
  "resolveNextDebateFlowStep",
  "advanceDebateFlowAfterMessage",
  "isStrictDebateFlow",
  "strictDebateFlowTurnTask",
  "format: language === \"zh-CN\" ? \"standard_cn\" : \"custom\"",
  "debateFlow: advanceDebateFlowAfterMessage",
  "strictFlowDone",
  "debatePhase: \"verdict_due\"",
]);

mustInclude("src/core/roomScheduler.ts", [
  "strictDebateFlowTurnTask(room, participant",
  "strictDebateFlowTurnTask(input.room, input.participant",
  "strictDebateFlowTurnTask(room, nextParticipant",
]);

if (failures.length > 0) {
  console.error("validate-room-debate-strict-flow failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-room-debate-strict-flow passed");

function mustInclude(relativePath, markers) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  for (const marker of markers) {
    if (!source.includes(marker)) {
      failures.push(`${relativePath} missing marker: ${marker}`);
    }
  }
}
