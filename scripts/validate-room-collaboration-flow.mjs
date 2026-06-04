import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(relativePath, patterns) {
  const text = read(relativePath);
  for (const pattern of patterns) {
    if (!text.includes(pattern)) {
      failures.push(`${relativePath} is missing ${pattern}`);
    }
  }
}

function mustIncludeCollaborationSurface(patterns) {
  const text = [
    "src/core/roomScheduler.ts",
    "src/core/roomCollaborationPolicy.ts",
  ]
    .map(read)
    .join("\n");
  for (const pattern of patterns) {
    if (!text.includes(pattern)) {
      failures.push(`room collaboration surface is missing ${pattern}`);
    }
  }
}

mustInclude("src/core/types.ts", [
  "RoomCollaborationPlan",
  "RoomCollaborationTask",
  "FactionStrategyState",
  "collaborationPlan: RoomCollaborationPlan | null",
  "collaborationPlan?: RoomCollaborationPlan",
  "collaborationTask?: RoomCollaborationTask",
  "factionStrategy?: FactionStrategyState",
  "nextPublicAction?: string",
]);

mustIncludeCollaborationSurface([
  "resolveCollaborationNeed",
  "getActiveRoomCollaborationTask",
  "buildCollaborationPlanFromHuddle",
  "createFactionStrategyObjective",
  "createFactionStrategyPublicPoints",
  "createFactionNextPublicAction",
  "collaborationPlan",
  "collaborationTask",
  "collaborationNeed.needsHuddle",
]);

mustInclude("src/main.ts", [
  "room.setCollaborationPlan",
  "completeRoomCollaborationTask",
  "buildCollaborationPromptForParticipant",
  "buildCompactCollaborationLine",
  "Collaboration plan:",
  "Current collaboration state:",
]);

mustInclude("src/ui/roomSurface.ts", [
  "collaborationPlan",
  "collaborationItems",
  "collaborationGoal",
  "collaborationTasks",
  "collaborationNextAction",
  "collaborationFactionStrategy",
]);

if (failures.length > 0) {
  console.error("Room collaboration flow validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Room collaboration flow validation passed.");
