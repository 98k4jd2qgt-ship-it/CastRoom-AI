import fs from "node:fs";

const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const copy = fs.readFileSync("src/ui/copy.ts", "utf8");
const failures = [];

mustInclude("function renderRoomGenerationControl", "room generation control renderer exists");
mustInclude("controls.append(renderRoomGenerationControl(props));", "room generation control is mounted inside the control section");
mustInclude('roomUiText(language, "roomGenerationSettings")', "generation control has a room-scoped title");
mustInclude('roomUiText(language, "roomGenerationUseGlobal")', "generation control offers global generation setting");
mustInclude('roomUiText(language, "roomGenerationCustom")', "generation control offers room custom generation setting");
mustInclude('type: "room.setGenerationMode"', "generation control writes room generation mode");
mustInclude('type: "room.setGenerationField"', "generation control writes room generation fields");
mustInclude('label: t(language, "roomAiConnection")', "details section labels low-frequency AI settings as AI connection");
mustInclude('actionButton(roomUiText(language, "openGlobalAiSettings"', "AI connection opens global AI settings with new wording");

const roomControlsBlock = sliceBetween("function renderRoomControls", "function renderRoomGenerationControl");
mustIncludeIn(roomControlsBlock, "renderRoomGenerationControl(props)", "generation control is directly below room controls");

const roomApiPanelBlock = sliceBetween("function renderRoomApiPanel", "function renderRoleApiList");
mustNotIncludeIn(roomApiPanelBlock, "renderRoomGenerationControl", "AI connection panel must not render generation control");
mustNotIncludeIn(roomApiPanelBlock, "room.setGenerationMode", "AI connection panel must not mutate generation mode");
mustNotIncludeIn(roomApiPanelBlock, "room.setGenerationField", "AI connection panel must not mutate generation fields");
mustNotIncludeIn(roomApiPanelBlock, "roomGenerationSettings", "AI connection panel must not show generation settings");

mustNotInclude("function renderRoomGenerationFields", "old room generation fields renderer should be removed");
mustNotInclude("openMainAiSettings", "old main AI settings key should not appear in Room surface");
mustNotInclude("roomModelSourceMain", "old Main model source key should not appear in Room surface");
mustNotIncludeIn(copy, "openMainAiSettings", "copy should not keep old main AI settings key");
mustNotIncludeIn(copy, "roomModelSourceMain", "copy should not keep old Main model source key");
mustNotIncludeIn(copy, "主 AI 设置", "copy should not keep 主 AI 设置 wording");
mustNotIncludeIn(copy, "主配置", "copy should not keep 主配置 wording");
mustIncludeIn(copy, "roomGenerationSettings:", "copy includes room generation settings key");
mustIncludeIn(copy, "roomAiConnection:", "copy includes AI connection key");
mustIncludeIn(copy, "openGlobalAiSettings:", "copy includes global AI settings shortcut key");
mustIncludeIn(copy, "roomModelSourceGlobal:", "copy includes Global model source key");

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("validate-room-ai-settings-placement: ok");

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
