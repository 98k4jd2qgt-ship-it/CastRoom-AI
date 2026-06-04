import fs from "node:fs";

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

mustInclude(scheduler, "export function buildAutonomousContinuation", "autonomous continuation helper");
mustInclude(scheduler, "const debateSpeaker = isDebateRoom(room) ? resolveNextDebateSpeakerAssignment(room)?.roleId : null", "debate fallback uses next assignment");
mustInclude(scheduler, "function resolveFallbackResponseAction", "fallback response resolver");
mustInclude(scheduler, "validateNextSpeakerEligibility", "fallback checks speaker eligibility");
mustInclude(scheduler, 'reason: "response_obligation"', "fallback follow-up reason");
mustInclude(scheduler, 'source: "system"', "fallback follow-up source");
mustInclude(scheduler, 'mode: "one_shot"', "fallback is finite one-shot");
mustInclude(scheduler, 'nextMove: "role_turn"', "fallback schedules role turn");
mustInclude(scheduler, "advanceDecision.action !== \"pause\"", "fallback only when policy allows continuation");
mustInclude(main, "result.pendingFollowup !== undefined", "main applies fallback pending follow-up");

if (failures.length) {
  console.error(`Room fallback continuation validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room fallback continuation validation passed.");

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}
