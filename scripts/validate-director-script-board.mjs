import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const types = read("src/core/types.ts");
const appState = read("src/core/appState.ts");
const scheduler = read("src/core/roomScheduler.ts");
const roomSurface = read("src/ui/roomSurface.ts");
const directorScriptSurface = sliceBetween(roomSurface, "function renderDirectorScriptEntry", "function renderRoomRulesDetail");

mustInclude(types, "export interface DirectorScriptBoard", "Director script board type should exist");
mustInclude(types, "export interface ScopedDirectorScript", "Director script should have room/mode scoped storage");
mustInclude(types, "directorScriptsByMode?: Partial<Record<RoomRecipeId, ScopedDirectorScript>>", "Room state should store Director scripts by mode");
mustInclude(types, "scriptBoard: DirectorScriptBoard", "RoomDirectorState should own script board");
mustInclude(appState, "createDefaultDirectorScriptBoard", "default room state should create script board");
mustInclude(appState, "normalizeDirectorScriptBoard", "runtime normalization should restore script board for old rooms");
mustInclude(appState, "normalizeDirectorScriptsByMode", "runtime normalization should scope old scripts to the active mode");
mustInclude(appState, "applyDirectorScriptMode", "mode changes should load the target mode Director script");
mustInclude(appState, "saveActiveDirectorScript", "plot and script edits should be saved into the active mode scope");
mustInclude(appState, "copyDirectorScript ?? true", "duplicating a room should default to copying Director Script");
mustInclude(appState, "createScopedDirectorScript(nextId", "duplicating or resetting a room should bind script scope to the new room id");
mustInclude(appState, 'case "room.updateDirectorScript"', "reducer should support script board patches");
mustInclude(scheduler, "createDirectorTickScriptPatch", "Director tick should update script board");
mustInclude(roomSurface, "directorScriptBoard", "developer inspector should show Director script summary");
mustInclude(roomSurface, "renderDirectorScriptEntry", "Director AI detail should expose a Director Script entry");
mustInclude(roomSurface, "renderDirectorScriptPanel", "Director Script entry should render the full script panel");
mustInclude(roomSurface, 'room.freedomLevel === "developer" || activeChannel.type === "director"', "Director Script entry should be limited to developer mode or Director channel");
mustInclude(roomSurface, "DirectorScriptDraftState", "Director Script panel should use a UI-only draft state");
mustInclude(roomSurface, "const directorScriptDrafts = new Map", "Director Script panel should keep drafts outside persistent schema");
mustInclude(roomSurface, "getDirectorScriptDraft", "Director Script panel should initialize and reuse drafts by room/mode");
mustInclude(roomSurface, "updateDirectorScriptDraft", "Director Script input should edit the local draft");
mustInclude(roomSurface, "resetDirectorScriptDraft", "Director Script panel should support discarding drafts");
mustInclude(roomSurface, "saveDirectorScriptDraft", "Director Script panel should save through an explicit save path");
mustInclude(roomSurface, "createDirectorScriptDraftPatch", "Director Script save should build a patch from draft differences");
mustInclude(roomSurface, "details.addEventListener(\"toggle\"", "Director Script open state should persist in the draft store");
mustInclude(roomSurface, "draft.open = details.open", "Director Script open state should not only depend on active channel");
mustInclude(roomSurface, 'type: "room.updateDirectorScript"', "Director Script save path should dispatch room.updateDirectorScript");
mustInclude(roomSurface, "saveDirectorScript", "Director Script panel should render a save button");
mustInclude(roomSurface, "resetDirectorScript", "Director Script panel should render a reset button");
mustInclude(roomSurface, "noDirectorScriptChanges", "Director Script save should handle unchanged drafts without dispatch");
mustNotInclude(directorScriptSurface, "window.prompt", "Director Script list editing should not use window.prompt");
mustNotInclude(directorScriptSurface, "textarea.addEventListener(\"change\"", "Director Script textarea edits should not dispatch on blur/change");
mustInclude(roomSurface, "room.id)}:${escapeHtml(mode)}", "Director Script panel should show roomId + mode scope binding");
mustInclude(roomSurface, "directorScriptPlotDirection", "Director Script panel should expose plot direction");
mustInclude(roomSurface, "directorScriptHiddenFacts", "Director Script panel should expose hidden facts");
mustInclude(roomSurface, "directorScriptPlannedBeats", "Director Script panel should expose planned beats");
mustInclude(roomSurface, "duplicateDirectorScriptConfirm", "room duplicate UI should ask whether to copy Director Script");

if (failures.length > 0) {
  console.error(`validate-director-script-board failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-script-board passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}

function mustNotInclude(text, marker, label) {
  if (text.includes(marker)) {
    failures.push(`${label}: should not include ${marker}`);
  }
}

function sliceBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    return text;
  }
  return text.slice(start, end);
}
