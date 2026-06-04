import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

mustInclude("src/core/types.ts", [
  "RoomDebateVerdict",
  "RoomDebateVerdictScore",
  "lastVerdict?: RoomDebateVerdict",
]);

mustInclude("src/core/directorModePolicy.ts", [
  "\"debate_final_verdict\"",
  "isDebateVerdictRequest",
  "judge the debate winner and write the result",
]);

mustInclude("src/core/debatePolicy.ts", [
  "isDebateVerdictRequest",
  "isDebateAdvantageRequest",
  "createDebateDirectorVerdictOutcome",
  "createDebateVerdictMatchPatch",
  "createDebateVerdictPublicText",
  "scoreDebateSides",
  "judgeNotes: [verdict.summary",
  "lastVerdict: verdict",
]);

mustInclude("src/core/roomScheduler.ts", [
  "createDebateDirectorVerdictOutcome",
  "debate_final_verdict",
  "return \"ruling\"",
]);

mustNotInclude("src/core/debatePolicy.ts", [
  "Director ruling",
  "Consequence: ",
]);

if (failures.length > 0) {
  console.error("validate-debate-director-judgement failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-debate-director-judgement passed");

function mustInclude(relativePath, markers) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  for (const marker of markers) {
    if (!source.includes(marker)) {
      failures.push(`${relativePath} missing marker: ${marker}`);
    }
  }
}

function mustNotInclude(relativePath, markers) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  for (const marker of markers) {
    if (source.includes(marker)) {
      failures.push(`${relativePath} contains forbidden marker: ${marker}`);
    }
  }
}
