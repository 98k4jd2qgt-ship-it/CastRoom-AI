import fs from "node:fs";

const failures = [];

const types = read("src/core/types.ts");
const appState = read("src/core/appState.ts");
const roomSurface = read("src/ui/roomSurface.ts");
const main = read("src/main.ts");
const collaborationPolicy = read("src/core/roomCollaborationPolicy.ts");
const styles = read("src/styles.css");
const packageJson = read("package.json");

validateTypes();
validateReducer();
validateUi();
validatePromptAndCollaboration();
validatePackageScript();

if (failures.length > 0) {
  console.error(`Room faction customization validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room faction customization validation passed.");

function validateTypes() {
  mustInclude(types, "publicGoal?: string", "RoomFaction publicGoal field");
  mustInclude(types, "privateGoal?: string", "RoomFaction privateGoal field");
  for (const action of ["room.addFaction", "room.updateFaction", "room.deleteFaction"]) {
    mustInclude(types, action, `ConsoleAction ${action}`);
  }
  mustInclude(types, "\"publicGoal\" | \"privateGoal\"", "room.updateFaction can patch goals");
}

function validateReducer() {
  for (const marker of [
    "case \"room.addFaction\"",
    "case \"room.updateFaction\"",
    "case \"room.deleteFaction\"",
    "normalizeRoomFactions",
    "createCustomRoomFaction",
    "vividFactionColorPalette",
    "selectVividFactionColor",
    "hslToHex",
    "syncDebateSpeakerAssignments",
  ]) {
    mustInclude(appState, marker, `appState marker ${marker}`);
  }
  for (const marker of [
    "activeChannelId",
    "userFactionHuddle",
    "userProfile",
    "participants: state.room.participants.map",
    "factionHuddleThreads",
    "faction.id !== factionId",
    "publicGoal: \"\"",
    "privateGoal: \"\"",
  ]) {
    mustInclude(appState, marker, `delete/add faction synchronization ${marker}`);
  }
  mustInclude(appState, "scoreboard: []", "new rooms start without debate team scores");
  mustInclude(appState, "color: selectVividFactionColor(factions)", "new user-created factions use vivid colors");
  mustInclude(appState, "color: selectVividFactionColor(normalizedFactions)", "auto-created fallback factions use vivid colors");
  for (const marker of ["{ id: \"team-a\"", "{ id: \"team-b\"", "{ id: \"team-c\""]) {
    mustNotInclude(appState, marker, `default room factions should not include ${marker}`);
  }
}

function validateUi() {
  for (const marker of [
    "renderFactionSettingsPanel",
    "factionTextInput",
    "room.addFaction",
    "room.updateFaction",
    "room.deleteFaction",
    "publicGoal",
    "privateGoal",
    "room-faction-settings",
  ]) {
    mustInclude(roomSurface, marker, `room faction UI marker ${marker}`);
  }
  for (const marker of [
    ".room-faction-settings",
    ".room-faction-settings-row",
    ".room-faction-field",
    ".room-faction-delete",
  ]) {
    mustInclude(styles, marker, `room faction CSS marker ${marker}`);
  }
}

function validatePromptAndCollaboration() {
  for (const marker of [
    "buildFactionGoalPromptBlock",
    "buildDirectorFactionGoalPromptBlock",
    "buildCompactFactionGoalLine",
    "Faction goals:",
    "Your faction private goal",
  ]) {
    mustInclude(main, marker, `faction goal prompt marker ${marker}`);
  }
  for (const marker of [
    "formatFactionGoalContext",
    "strategyTopic",
    "public goal:",
    "private goal:",
    "createFactionStrategyObjective(room, faction.name, strategyTopic)",
  ]) {
    mustInclude(collaborationPolicy, marker, `faction goal collaboration marker ${marker}`);
  }
}

function validatePackageScript() {
  mustInclude(packageJson, "node scripts/validate-room-faction-customization.mjs", "package check includes faction customization validation");
}

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustInclude(source, needle, label) {
  if (!source.includes(needle)) {
    failures.push(`Missing ${label}: ${needle}`);
  }
}

function mustNotInclude(source, needle, label) {
  if (source.includes(needle)) {
    failures.push(`Unexpected ${label}: ${needle}`);
  }
}
