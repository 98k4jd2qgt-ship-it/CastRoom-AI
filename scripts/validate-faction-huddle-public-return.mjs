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

mustInclude("src/core/types.ts", [
  "publicSafePoints?: string[]",
  "privateNotes?: string[]",
  "publicReturnPlan?: string",
  "privateBoundary?: string",
]);

mustInclude("src/core/roomCollaborationPolicy.ts", [
  "members.slice(0, 4)",
  "publicSafePoints",
  "privateNotes",
  "publicReturnPlan",
  "stage: \"act\"",
  "Speak in the public channel and do not expose the private huddle.",
]);

mustInclude("src/main.ts", [
  "createFactionChannelMessages",
  "thread.entries.map",
  "speakerType: \"role\"",
  "for (const message of createFactionChannelMessages(result.factionHuddle))",
]);

mustInclude("src/ui/roomSurface.ts", [
  "factionCollaborationOpportunity",
  "factionHuddleStage",
  "factionPrivateBoundary",
  "latestHuddle?.publicReturnPlan",
]);

if (failures.length > 0) {
  console.error("validate-faction-huddle-public-return failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-faction-huddle-public-return passed");
