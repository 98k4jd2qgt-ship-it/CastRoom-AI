import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const createRenderLocalUpdate = sliceFunction(main, "createRenderLocalUpdate");
mustInclude(createRenderLocalUpdate, 'workspace === "room"', "Room workspace has a local update path");
mustInclude(createRenderLocalUpdate, "return notifyRoomSurfaceUpdated", "Room local update preserves input shell");

const notifyRoomSurfaceUpdated = sliceFunction(main, "notifyRoomSurfaceUpdated");
mustInclude(notifyRoomSurfaceUpdated, 'querySelector<HTMLElement>(".room-surface")', "Room local update targets existing room surface");
mustInclude(notifyRoomSurfaceUpdated, "renderRoomSurface(createRoomSurfaceRenderProps(createDesktopContext()))", "Room local update renders fresh non-input content");
mustInclude(notifyRoomSurfaceUpdated, '\".room-surface-topbar\", \".room-role-strip\", \".room-surface-main\"', "Room local update replaces only non-input regions");
mustNotInclude(notifyRoomSurfaceUpdated, ".room-input-row", "Room local update must not replace the input row");
mustInclude(notifyRoomSurfaceUpdated, "restoreConversationInputState(inputSnapshot)", "Room local update restores draft and focus");

const shouldAvoidFullRender = sliceFunction(main, "shouldAvoidFullRender");
mustInclude(shouldAvoidFullRender, "isWorkspaceInputRenderSensitive(workspace)", "full render is avoided while input is active");

const handleRoomSurfaceInput = sliceFunction(main, "handleRoomSurfaceInput");
mustInclude(handleRoomSurfaceInput, 'requestRender("room_input", { kind: "message" })', "Room submit no longer forces structural render");
mustNotInclude(handleRoomSurfaceInput, 'requestRender("room_input", { structural: true })', "Room submit must not rebuild the full surface");

if (failures.length) {
  console.error(`Room input no-full-render validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room input no-full-render validation passed.");

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

function mustNotInclude(text, marker, label) {
  if (text.includes(marker)) {
    failures.push(`unexpected ${label}: ${marker}`);
  }
}
