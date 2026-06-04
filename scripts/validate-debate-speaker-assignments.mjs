import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

mustInclude("src/core/types.ts", [
  "RoomDebateSpeakerPosition",
  "RoomDebateSpeakerPositionSetting",
  "RoomDebateSpeakerAssignment",
  "speakerAssignments",
  "nextSpeakerRoleId",
  "nextPosition",
  "room.setDebateSpeakerPosition",
]);

mustInclude("src/core/appState.ts", [
  "syncDebateSpeakerAssignments",
  "setRoomDebateSpeakerPosition",
  "first_speaker",
  "second_speaker",
  "third_speaker",
  "source: \"manual\"",
  "room.setDebateSpeakerPosition",
]);

mustIncludeDebateSurface([
  "getDebateSpeakerAssignment",
  "debateSpeakerSequence",
  "resolveNextDebateSpeakerAssignment",
  "advanceDebateMatchAfterSpeaker",
  "formatDebateAssignments",
  "debateSpeakerRoleDescription",
  "createDebateDirectorMatchPatch",
  "createDebateDirectorSetupText",
  "debateSpeakerPositionLabel",
  "nextSpeakerRoleId",
  "resolveNextDebateSpeakerAssignment(room, Array.from(visibleRoleIds))",
  "resolveNextDebateSpeakerAssignment(room, visibleRoleIds)",
  "createDebateTurnGoal(room, speaker, 0)",
  "first speaker opens",
  "buildPrivateRoleDirective",
  "privateDirective",
  "shouldCommitDirectorPublicText",
]);

mustInclude("src/main.ts", [
  "advanceDebateMatchAfterSpeaker",
  "debateSpeakerRoleDescription",
  "Speaker position",
  "你的辩位",
  "result.match",
  "!result.simulationBeat",
  "injectPrivateDirectiveIntoRolePrompt",
  "isPlannerLikeRoleOutput",
  "Room.role.plannerLikeBlocked",
]);

mustInclude("src/ui/roomSurface.ts", [
  "room.setDebateSpeakerPosition",
  "room-debate-position-select",
  "room-debate-control",
  "chooseTeamFirst",
  "disabled: positionDisabled",
  "speakerAssignments",
  "nextSpeaker",
]);

mustInclude("src/styles.css", [
  ".room-faction-row-debate",
  ".room-debate-control",
  ".room-debate-position-select",
]);

if (failures.length > 0) {
  console.error("validate-debate-speaker-assignments failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-debate-speaker-assignments passed");

function mustInclude(relativePath, markers) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  for (const marker of markers) {
    if (!source.includes(marker)) {
      failures.push(`${relativePath} missing marker: ${marker}`);
    }
  }
}

function mustIncludeDebateSurface(markers) {
  const source = [
    "src/core/roomScheduler.ts",
    "src/core/debatePolicy.ts",
  ].map((relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")).join("\n");
  for (const marker of markers) {
    if (!source.includes(marker)) {
      failures.push(`debate scheduler surface missing marker: ${marker}`);
    }
  }
}
