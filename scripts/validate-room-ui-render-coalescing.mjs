import fs from "node:fs";

const failures = [];
const main = fs.readFileSync("src/main.ts", "utf8");

const queueRoomSurfaceUpdate = sliceFunction(main, "queueRoomSurfaceUpdate");
const flushRoomSurfaceUpdateQueue = sliceFunction(main, "flushRoomSurfaceUpdateQueue");
const patchElementIfChanged = sliceFunction(main, "patchElementIfChanged");
const patchRoomInspectorRail = sliceFunction(main, "patchRoomInspectorRail");
const notifyRoomSurfaceUpdated = sliceFunction(main, "notifyRoomSurfaceUpdated");
const notifyRoomTimelineUpdated = sliceFunction(main, "notifyRoomTimelineUpdated");
const notifyRoomInspectorUpdated = sliceFunction(main, "notifyRoomInspectorUpdated");
const createRenderLocalUpdate = sliceFunction(main, "createRenderLocalUpdate");
const isRoomRoleStripOnlyRenderReason = sliceFunction(main, "isRoomRoleStripOnlyRenderReason");
const isRoomAutoSchedulingOnlyRenderReason = sliceFunction(main, "isRoomAutoSchedulingOnlyRenderReason");

mustInclude(main, "interface RoomSurfaceUpdateQueueState", "room surface update queue state");
mustInclude(main, "const roomSurfaceUpdateQueue", "room surface update queue instance");
mustInclude(queueRoomSurfaceUpdate, "window.requestAnimationFrame(flushRoomSurfaceUpdateQueue)", "room updates are coalesced in one animation frame");
mustInclude(flushRoomSurfaceUpdateQueue, "const nextShell = renderRoomSurface", "room shell is rendered once per queued flush");
mustInclude(flushRoomSurfaceUpdateQueue, 'patchRoomSurfacePart(shell, nextShell, kinds, "main"', "timeline/main patch is targeted");
mustInclude(flushRoomSurfaceUpdateQueue, 'patchRoomSurfacePart(shell, nextShell, kinds, "timeline"', "message timeline patch is targeted");
mustInclude(flushRoomSurfaceUpdateQueue, 'patchRoomSurfacePart(shell, nextShell, kinds, "roles"', "role strip patch is targeted");
mustInclude(flushRoomSurfaceUpdateQueue, 'patchRoomSurfacePart(shell, nextShell, kinds, "inspector"', "inspector patch is targeted");
mustInclude(flushRoomSurfaceUpdateQueue, "const timelineOnly = isTimelineOnlyRoomSurfaceUpdate(kinds)", "timeline-only updates are detected");
mustInclude(flushRoomSurfaceUpdateQueue, "const inputSnapshot = timelineOnly ? null : captureConversationInputSnapshot()", "timeline-only updates do not capture input snapshots");
mustInclude(flushRoomSurfaceUpdateQueue, "if (inputSnapshot) {\n    restoreConversationInputState(inputSnapshot);", "timeline-only updates do not restore input values");
mustInclude(patchElementIfChanged, "current.isEqualNode(next)", "unchanged room sections are not replaced");
mustInclude(patchRoomInspectorRail, '".room-inspector-status"', "inspector status is patched as a stable sub-section");
mustInclude(patchRoomInspectorRail, '".room-context-panel"', "inspector context panel is patched as a stable sub-section");
mustInclude(patchRoomInspectorRail, '".room-inspector-actions"', "inspector controls are patched as a stable sub-section");
mustInclude(patchRoomInspectorRail, '".room-inspector-details"', "inspector details are patched as a stable sub-section");
mustNotInclude(patchRoomInspectorRail, "currentRail.replaceWith(nextRail)", "inspector rail should not be replaced for normal status changes");
mustInclude(notifyRoomSurfaceUpdated, 'queueRoomSurfaceUpdate("room_surface_update", ["main"])', "surface update no longer patches roles or inspector by default");
mustInclude(notifyRoomTimelineUpdated, 'queueRoomSurfaceUpdate("room_timeline_update", ["timeline"])', "message timeline update uses a timeline-only queue");
mustInclude(notifyRoomInspectorUpdated, "scheduleRoomInspectorStablePatch", "inspector update uses stable snapshot queue");
mustNotInclude(notifyRoomInspectorUpdated, ".room-surface-topbar", "inspector update no longer patches topbar directly");
mustInclude(createRenderLocalUpdate, "return notifyRoomTimelineUpdated", "message updates patch only the timeline");
mustNotInclude(createRenderLocalUpdate, "return notifyRoomSurfaceUpdated;\n    }\n    if (isRoomRoleStripOnlyRenderReason", "message updates should not use full room surface patch");
mustInclude(createRenderLocalUpdate, "isRoomRoleStripOnlyRenderReason(reason)", "participant status updates use role-only render routing");
mustInclude(createRenderLocalUpdate, 'queueRoomSurfaceUpdate(reason, ["roles"])', "participant status updates patch only the role strip");
mustInclude(createRenderLocalUpdate, "isRoomAutoSchedulingOnlyRenderReason(reason)", "auto scheduling transients avoid inspector refresh");
mustInclude(createRenderLocalUpdate, "scheduleRoomInspectorStablePatch(reason)", "room status updates use stable inspector snapshots");
mustInclude(isRoomRoleStripOnlyRenderReason, 'reason.startsWith("room_participant_")', "role-only render reason covers participant state changes");
mustInclude(isRoomAutoSchedulingOnlyRenderReason, 'reason === "room_auto_turn_scheduled"', "auto turn scheduled does not refresh inspector");
mustInclude(isRoomAutoSchedulingOnlyRenderReason, 'reason === "room_auto_turn_busy"', "auto turn busy does not refresh inspector");
mustInclude(isRoomAutoSchedulingOnlyRenderReason, 'reason === "room_auto_no_runnable_work"', "auto no-runnable-work does not refresh inspector");
mustInclude(isRoomAutoSchedulingOnlyRenderReason, 'reason === "room_auto_not_foreground"', "auto not-foreground does not refresh inspector");
mustNotInclude(createRenderLocalUpdate, '["roles", "inspector"]', "participant status updates should not refresh the inspector");

if (failures.length) {
  console.error(`Room UI render coalescing validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room UI render coalescing validation passed.");

function sliceFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start === -1) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
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
