import fs from "node:fs";

const expandableText = fs.readFileSync("src/ui/expandableText.ts", "utf8");
const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

mustInclude(expandableText, "key?: string", "expandable text accepts a stable key");
mustInclude(expandableText, "initialExpanded?: boolean", "expandable text can render an initial expanded state");
mustInclude(expandableText, "wrapper.dataset.expandableKey", "expandable text writes data-expandable-key");
mustInclude(expandableText, "toggle.dataset.expandLabel", "expandable text exposes the expand label for restoration");
mustInclude(expandableText, "toggle.dataset.collapseLabel", "expandable text exposes the collapse label for restoration");

const contextRenderer = sliceFunction(roomSurface, "renderRoomInspectorContext");
mustInclude(contextRenderer, '"room-context"', "Room Inspector context uses a stable expandable key prefix");
mustInclude(contextRenderer, "props.state.room.id", "Room Inspector expandable keys include room id");
mustInclude(contextRenderer, "sectionModel.id", "Room Inspector expandable keys include section id");
mustInclude(contextRenderer, "item.id", "Room Inspector expandable keys support optional item ids");
mustInclude(contextRenderer, "key: expandableKey", "Room Inspector passes stable expandable keys");

mustInclude(main, "interface RoomSurfaceUiSnapshot", "Room UI snapshot type exists");
mustInclude(main, "function captureRoomSurfaceUiSnapshot", "Room UI snapshot capture exists");
mustInclude(main, "function restoreRoomSurfaceUiSnapshot", "Room UI snapshot restore exists");
mustInclude(main, ".expandable-text[data-expandable-key]", "Room UI snapshot targets keyed expandable text");
mustInclude(main, "content.dataset.expanded = \"true\"", "Room UI snapshot restores expanded content");
mustInclude(main, "toggle.setAttribute(\"aria-expanded\", \"true\")", "Room UI snapshot restores aria-expanded");

const roomUpdate = sliceFunction(main, "notifyRoomSurfaceUpdated");
const inspectorUpdate = sliceFunction(main, "notifyRoomInspectorUpdated");
mustInclude(roomUpdate, "captureRoomSurfaceUiSnapshot(shell)", "full Room local update captures UI state");
mustInclude(roomUpdate, "restoreRoomSurfaceUiSnapshot(roomUiSnapshot)", "full Room local update restores UI state");
mustInclude(inspectorUpdate, "captureRoomSurfaceUiSnapshot(shell)", "Inspector local update captures UI state");
mustInclude(inspectorUpdate, "restoreRoomSurfaceUiSnapshot(roomUiSnapshot)", "Inspector local update restores UI state");

if (failures.length) {
  console.error(`Room Inspector expanded-state validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room Inspector expanded-state validation passed.");

function sliceFunction(text, name) {
  const start = text.indexOf(`function ${name}`);
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const next = text.indexOf("\nfunction ", start + 1);
  return next < 0 ? text.slice(start) : text.slice(start, next);
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}
