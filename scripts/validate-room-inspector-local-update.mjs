import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const createRenderLocalUpdate = sliceFunction(main, "createRenderLocalUpdate");
mustInclude(createRenderLocalUpdate, 'workspace === "room"', "Room workspace has a local update path");
mustInclude(createRenderLocalUpdate, 'options.kind === "message"', "message updates keep using the full non-input Room refresh");
mustInclude(createRenderLocalUpdate, "return notifyRoomSurfaceUpdated", "message updates can refresh timeline-bearing Room regions");
mustInclude(createRenderLocalUpdate, "return notifyRoomInspectorUpdated", "status/diagnostic updates use the Inspector local refresh");

const inspectorUpdate = sliceFunction(main, "notifyRoomInspectorUpdated");
const patchRoomInspectorRail = sliceFunction(main, "patchRoomInspectorRail");
const patchElementIfChanged = sliceFunction(main, "patchElementIfChanged");
mustInclude(inspectorUpdate, 'queueRoomSurfaceUpdate("room_inspector_update", ["inspector"])', "Inspector update targets the queued right rail patch");
mustInclude(patchRoomInspectorRail, '".room-inspector-status"', "Inspector update patches status as a right-rail section");
mustInclude(patchRoomInspectorRail, '".room-context-panel"', "Inspector update patches context as a right-rail section");
mustInclude(patchRoomInspectorRail, '".room-inspector-actions"', "Inspector update patches controls as a right-rail section");
mustInclude(patchRoomInspectorRail, '".room-inspector-details"', "Inspector update patches details as a right-rail section");
mustInclude(patchElementIfChanged, "current.isEqualNode(next)", "Inspector update skips no-op DOM replacements");
mustNotInclude(inspectorUpdate, '".room-surface-main"', "status updates must not replace the full Room main region");
mustNotInclude(inspectorUpdate, "scheduleConversationScrollToBottom", "status updates must not scroll the timeline to bottom");
mustNotInclude(inspectorUpdate, "markRenderedSurface", "status updates must not mark timeline message counts as rendered");

const flushRoomSurfaceUpdateQueue = sliceFunction(main, "flushRoomSurfaceUpdateQueue");
mustInclude(flushRoomSurfaceUpdateQueue, 'patchRoomSurfacePart(shell, nextShell, kinds, "main"', "message updates may replace the main region");
mustInclude(flushRoomSurfaceUpdateQueue, "resolveConversationScrollTarget", "message updates still resolve timeline follow-scroll");
mustInclude(flushRoomSurfaceUpdateQueue, "restoreOrFollowConversationScroll", "message updates still restore or follow timeline scroll");

if (failures.length) {
  console.error(`Room Inspector local-update validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room Inspector local-update validation passed.");

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
