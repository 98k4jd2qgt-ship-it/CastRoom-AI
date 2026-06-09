import fs from "node:fs";

const failures = [];
const main = fs.readFileSync("src/main.ts", "utf8");

const queueRoomSurfaceUpdate = sliceFunction(main, "queueRoomSurfaceUpdate");
const flushRoomSurfaceUpdateQueue = sliceFunction(main, "flushRoomSurfaceUpdateQueue");
const patchElementIfChanged = sliceFunction(main, "patchElementIfChanged");
const patchRoomInspectorRail = sliceFunction(main, "patchRoomInspectorRail");
const notifyRoomSurfaceUpdated = sliceFunction(main, "notifyRoomSurfaceUpdated");
const notifyRoomInspectorUpdated = sliceFunction(main, "notifyRoomInspectorUpdated");
const createRenderLocalUpdate = sliceFunction(main, "createRenderLocalUpdate");
const isRoomRoleStripOnlyRenderReason = sliceFunction(main, "isRoomRoleStripOnlyRenderReason");
const isRoomAutoSchedulingOnlyRenderReason = sliceFunction(main, "isRoomAutoSchedulingOnlyRenderReason");

mustInclude(main, "interface RoomSurfaceUpdateQueueState", "room surface update queue state");
mustInclude(main, "const roomSurfaceUpdateQueue", "room surface update queue instance");
mustInclude(queueRoomSurfaceUpdate, "window.requestAnimationFrame(flushRoomSurfaceUpdateQueue)", "room updates are coalesced in one animation frame");
mustInclude(flushRoomSurfaceUpdateQueue, "const nextShell = renderRoomSurface", "room shell is rendered once per queued flush");
mustInclude(flushRoomSurfaceUpdateQueue, 'patchRoomSurfacePart(shell, nextShell, kinds, "main"', "timeline/main patch is targeted");
mustInclude(flushRoomSurfaceUpdateQueue, 'patchRoomSurfacePart(shell, nextShell, kinds, "roles"', "role strip patch is targeted");
mustInclude(flushRoomSurfaceUpdateQueue, 'patchRoomSurfacePart(shell, nextShell, kinds, "inspector"', "inspector patch is targeted");
mustInclude(patchElementIfChanged, "current.isEqualNode(next)", "unchanged room sections are not replaced");
mustInclude(patchRoomInspectorRail, '".room-inspector-status"', "inspector status is patched as a stable sub-section");
mustInclude(patchRoomInspectorRail, '".room-context-panel"', "inspector context panel is patched as a stable sub-section");
mustInclude(patchRoomInspectorRail, '".room-inspector-actions"', "inspector controls are patched as a stable sub-section");
mustInclude(patchRoomInspectorRail, '".room-inspector-details"', "inspector details are patched as a stable sub-section");
mustNotInclude(patchRoomInspectorRail, "currentRail.replaceWith(nextRail)", "inspector rail should not be replaced for normal status changes");
mustInclude(notifyRoomSurfaceUpdated, "queueRoomSurfaceUpdate", "message surface update uses queue");
mustInclude(notifyRoomInspectorUpdated, "queueRoomSurfaceUpdate", "inspector update uses queue");
mustNotInclude(notifyRoomInspectorUpdated, ".room-surface-topbar", "inspector update no longer patches topbar directly");
mustInclude(createRenderLocalUpdate, "isRoomRoleStripOnlyRenderReason(reason)", "participant status updates use role-only render routing");
mustInclude(createRenderLocalUpdate, 'queueRoomSurfaceUpdate(reason, ["roles"])', "participant status updates patch only the role strip");
mustInclude(createRenderLocalUpdate, "isRoomAutoSchedulingOnlyRenderReason(reason)", "auto scheduling transients avoid inspector refresh");
mustInclude(isRoomRoleStripOnlyRenderReason, 'reason.startsWith("room_participant_")', "role-only render reason covers participant state changes");
mustInclude(isRoomAutoSchedulingOnlyRenderReason, 'reason === "room_auto_turn_scheduled"', "auto turn scheduled does not refresh inspector");
mustInclude(isRoomAutoSchedulingOnlyRenderReason, 'reason === "room_auto_turn_busy"', "auto turn busy does not refresh inspector");
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
