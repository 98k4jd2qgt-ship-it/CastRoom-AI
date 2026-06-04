import fs from "node:fs";

const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const copy = fs.readFileSync("src/ui/copy.ts", "utf8");
const failures = [];

mustInclude("function resolveEffectiveRoomModelDisplay", "room effective model display helper");
mustInclude("function resolveEffectiveDirectorModelDisplay", "director effective model display helper");
mustInclude("function resolveEffectiveRoleModelDisplay", "role effective model display helper");
mustInclude("function localChatModelDisplayName", "local model friendly name helper");
mustInclude("state.ai.localChatModel.enabled || state.room.apiProfile.mode === \"demo\"", "room display prefers enabled local model");
mustInclude("state.ai.localChatModel.enabled || api.mode === \"demo\"", "director display prefers enabled local model");
mustInclude("state.ai.localChatModel.enabled)", "role display prefers enabled local model");
mustInclude("local.selectedModelId ?? local.modelId ?? local.manifest?.id", "local model display uses selected model id");
mustInclude("selectedModel?.displayName", "local model display uses manifest display name");
mustInclude("resolveEffectiveRoomModelDisplay(state, language).model", "director/role room inheritance uses effective room model");
mustInclude("statusPill(t(language, \"roomEffectiveModel\"), resolveEffectiveRoomModelDisplay", "Room API panel shows effective model");
mustInclude("statusPill(t(language, \"roomEffectiveModel\"), resolveEffectiveDirectorModelDisplay", "Director API panel shows effective model");
mustInclude("actionButton(roomUiText(language, \"openGlobalAiSettings\"", "Room AI connection panels expose global AI settings shortcut");
mustInclude("props.onOpenConsole(\"ai\")", "global AI settings shortcut opens AI console view");
mustInclude("function renderRoomUncertaintySelect", "Room uncertainty select is rendered from Room settings");
mustInclude("type: \"room.setSimulationState\"", "Room uncertainty select writes simulation state");
mustInclude("uncertaintyProfile: value as ConsoleAppState[\"room\"][\"simulation\"][\"uncertaintyProfile\"]", "Room uncertainty select updates uncertaintyProfile");
mustInclude("formatRoleApiStatus(props.state, participant", "role API status receives full app state");

const effectiveBlock = sliceBetween("interface EffectiveModelDisplay", "function roomApiStatusText");
mustNotIncludeIn(effectiveBlock, "visionModel", "effective text model display must not read vision model");
mustNotInclude(
  "statusPill(t(language, \"roomApiModel\"), api.mode === \"demo\" ? t(language, \"statusLocal\") : api.chatModel)",
  "Room API panel must not show raw room chatModel field",
);
mustNotInclude(
  "statusPill(t(language, \"roomDirectorApiModel\"), api.mode === \"demo\" ? t(language, \"statusLocal\") : api.chatModel)",
  "Director API panel must not show raw director chatModel field",
);
mustNotInclude(
  "participant.apiProfile.chatModel}`",
  "role status must not append raw role chatModel outside effective model helper",
);
mustNotInclude("roomModelSourceMain", "Room model source should use Global instead of Main");
mustNotInclude("openMainAiSettings", "Room UI should not expose the old main AI settings key");
mustNotInclude("Main setup", "Room UI should not use Main setup wording");
mustNotInclude("主配置", "Room UI should not use 主配置 wording");
mustNotInclude("主 AI 设置", "Room UI should not use 主 AI 设置 wording");

for (const key of [
  "roomEffectiveModel",
  "roomModelSourceLocal",
  "roomModelSourceGlobal",
  "roomModelSourceRoom",
  "roomModelSourceDirector",
  "roomModelSourceRoleModel",
  "roomModelSourceRoleKey",
  "openGlobalAiSettings",
]) {
  mustIncludeIn(copy, `${key}:`, `copy key ${key}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("validate-room-effective-model-display: ok");

function mustInclude(needle, message) {
  mustIncludeIn(roomSurface, needle, message);
}

function mustIncludeIn(source, needle, message) {
  if (!source.includes(needle)) {
    failures.push(`${message}: missing ${needle}`);
  }
}

function mustNotInclude(needle, message) {
  mustNotIncludeIn(roomSurface, needle, message);
}

function mustNotIncludeIn(source, needle, message) {
  if (source.includes(needle)) {
    failures.push(`${message}: found ${needle}`);
  }
}

function sliceBetween(startMarker, endMarker) {
  const start = roomSurface.indexOf(startMarker);
  const end = roomSurface.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    failures.push(`could not slice ${startMarker} -> ${endMarker}`);
    return "";
  }
  return roomSurface.slice(start, end);
}
