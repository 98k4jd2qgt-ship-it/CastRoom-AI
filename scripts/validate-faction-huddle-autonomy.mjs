import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(relativePath, markers) {
  const source = read(relativePath);
  for (const marker of markers) {
    if (!source.includes(marker)) {
      failures.push(`${relativePath} missing marker: ${marker}`);
    }
  }
}

function mustNotInclude(relativePath, markers) {
  const source = read(relativePath);
  for (const marker of markers) {
    if (source.includes(marker)) {
      failures.push(`${relativePath} still includes retired marker: ${marker}`);
    }
  }
}

mustInclude("src/core/types.ts", [
  "FactionCollaborationOpportunity",
  "initiator: FactionCollaborationInitiator",
  "urgency: number",
  "privacyNeed: number",
  "publicReturnPlan: string",
  "cooldownKey: string",
]);

mustInclude("src/core/roomCollaborationPolicy.ts", [
  "resolveFactionCollaborationOpportunity",
  "hasCoordinationSignal",
  "modeOpportunityScore",
  "privacyNeedScore",
  "initiator: trigger === \"user\" ? \"user\" : mode === \"team_strategy\" ? \"role\" : \"director\"",
  "cooldownKey:",
]);

mustInclude("src/core/roomScheduler.ts", [
  "collaborationNeed.opportunity",
  "opportunity.urgency",
  "opportunity.cooldownKey",
  "recentlyUsedFactionHuddle(room, factionId, opportunity.cooldownKey)",
]);

mustNotInclude("src/core/roomScheduler.ts", [
  "trigger !== \"auto\" || addressing.target !== \"all\"",
]);

if (failures.length > 0) {
  console.error("validate-faction-huddle-autonomy failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-faction-huddle-autonomy passed");
