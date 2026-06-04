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

function mustIncludeRoomPolicySurface(markers) {
  const source = [
    "src/core/roomScheduler.ts",
    "src/core/roomCollaborationPolicy.ts",
  ]
    .map(read)
    .join("\n");
  for (const marker of markers) {
    if (!source.includes(marker)) {
      failures.push(`room policy surface missing marker: ${marker}`);
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

mustIncludeRoomPolicySurface([
  "chooseCollaborationDirectiveParticipant",
  "stage: \"act\"",
  "status: isNextSpeaker ? \"active\" : \"pending\"",
  "Complete your own part directly; do not describe the plan or ask another role to speak.",
  "reason: collaborationTask ? \"follow_up\"",
  "Speak in the public channel and do not expose the private huddle.",
]);

mustInclude("src/main.ts", [
  "createRoomPlannerFallbackReply",
  "createModeFallbackReply",
  "Room.role.plannerLikeBlocked",
  "result.message.visibility === \"faction_huddle\"",
]);

mustNotInclude("src/main.ts", [
  "if (!result.participant || !isDebateRoomForPrompt(consoleState.room)) {\n    return false;\n  }",
]);

if (failures.length > 0) {
  console.error("validate-room-director-collaboration-behavior failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-room-director-collaboration-behavior passed");
