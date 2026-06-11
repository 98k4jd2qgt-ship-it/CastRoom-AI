import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const createRenderLocalUpdate = sliceFunction(main, "createRenderLocalUpdate");
mustInclude(createRenderLocalUpdate, 'workspace === "room"', "Room workspace has a local update path");
mustInclude(createRenderLocalUpdate, "return notifyRoomTimelineUpdated", "Room message update preserves input shell");

const notifyRoomTimelineUpdated = sliceFunction(main, "notifyRoomTimelineUpdated");
const flushRoomSurfaceUpdateQueue = sliceFunction(main, "flushRoomSurfaceUpdateQueue");
mustInclude(notifyRoomTimelineUpdated, 'queueRoomSurfaceUpdate("room_timeline_update", ["timeline"])', "Room message update targets existing timeline surface");
mustInclude(flushRoomSurfaceUpdateQueue, 'patchRoomSurfacePart(shell, nextShell, kinds, "timeline"', "Room message update replaces only the timeline");
mustInclude(flushRoomSurfaceUpdateQueue, "const timelineOnly = isTimelineOnlyRoomSurfaceUpdate(kinds)", "timeline-only message update is detected");
mustInclude(flushRoomSurfaceUpdateQueue, "const inputSnapshot = timelineOnly ? null : captureConversationInputSnapshot()", "timeline-only message update does not capture input value");
mustInclude(flushRoomSurfaceUpdateQueue, "if (inputSnapshot) {\n    restoreConversationInputState(inputSnapshot);", "timeline-only message update does not restore stale input value");

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
