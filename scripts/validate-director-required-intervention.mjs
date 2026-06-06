import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const types = read("src/core/types.ts");
const scheduler = read("src/core/roomScheduler.ts");

for (const marker of [
  '"action_ruling"',
  '"visibility_guard"',
  '"stuck_recovery"',
  '"memory_conflict"',
  '"debate_ruling"',
  '"study_judgement"',
  '"planning_summary"',
  '"script_revision"',
]) {
  mustInclude(types, marker, `DirectorRequiredIntervention should include ${marker}`);
}

mustInclude(scheduler, "evaluateRoomAction({", "Director tick should check action gates");
mustInclude(scheduler, 'requiredIntervention === "action_ruling"', "action ruling should be represented as required intervention");
mustInclude(scheduler, 'requiredIntervention === "stuck_recovery"', "stuck recovery should be represented as required intervention");
mustInclude(scheduler, 'room.simulation.directorMemoryDisputedClaims', "memory conflict should be observed by Director tick");
mustInclude(scheduler, 'visibilityRisk === "high"', "visibility risk should be observed by Director tick");

if (failures.length > 0) {
  console.error(`validate-director-required-intervention failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-required-intervention passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}
