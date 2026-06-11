import fs from "node:fs";

const failures = [];
const main = fs.readFileSync("src/main.ts", "utf8");

const notifyRoomInspectorUpdated = sliceFunction(main, "notifyRoomInspectorUpdated");
const scheduleRoomInspectorStablePatch = sliceFunction(main, "scheduleRoomInspectorStablePatch");
const commitRoomInspectorStablePatch = sliceFunction(main, "commitRoomInspectorStablePatch");
const createRoomInspectorStableSnapshot = sliceFunction(main, "createRoomInspectorStableSnapshot");
const createStableRoomFlowLabel = sliceFunction(main, "createStableRoomFlowLabel");
const createRenderLocalUpdate = sliceFunction(main, "createRenderLocalUpdate");
const isRoomAutoSchedulingOnlyRenderReason = sliceFunction(main, "isRoomAutoSchedulingOnlyRenderReason");

mustInclude(main, "interface RoomInspectorStableSnapshot", "stable inspector snapshot type");
mustInclude(main, "ROOM_INSPECTOR_STABLE_PATCH_DELAY_MS = 1000", "default one-second inspector throttle");
mustInclude(main, "roomInspectorStableSnapshotKey", "stable inspector snapshot hash cache");
mustInclude(main, "roomInspectorStablePatchTimer", "stable inspector throttle timer");
mustInclude(notifyRoomInspectorUpdated, "scheduleRoomInspectorStablePatch", "inspector notify routes through stable snapshots");
mustInclude(scheduleRoomInspectorStablePatch, "createRoomInspectorStableSnapshotKey()", "stable patch computes a snapshot hash");
mustInclude(scheduleRoomInspectorStablePatch, "nextSnapshotKey === roomInspectorStableSnapshotKey", "unchanged snapshots do not patch");
mustInclude(scheduleRoomInspectorStablePatch, "window.setTimeout", "ordinary inspector updates are throttled");
mustInclude(scheduleRoomInspectorStablePatch, "ROOM_INSPECTOR_STABLE_PATCH_DELAY_MS", "ordinary inspector updates use the throttle delay");
mustInclude(commitRoomInspectorStablePatch, 'queueRoomSurfaceUpdate(reason, ["inspector"])', "stable commit patches only the inspector");
mustInclude(main, "flowLabel", "snapshot contains visible flow label");
mustNotInclude(createRoomInspectorStableSnapshot, "recentPublicActivity", "snapshot is not invalidated by every public message");
mustNotInclude(createRoomInspectorStableSnapshot, "simulation.currentFocus", "snapshot ignores stale diagnostic focus");
mustInclude(main, "hardStopReason", "snapshot contains hard-stop reason");
mustInclude(createStableRoomFlowLabel, 'return isContinuous ? "auto_active" : "waiting_user"', "continuous hides soft user waits");
mustInclude(createStableRoomFlowLabel, 'return "queued"', "cooling down maps to stable queued state");
mustInclude(createStableRoomFlowLabel, '"auto_recovering"', "invalid queued state maps to recovery");
mustInclude(createStableRoomFlowLabel, 'return "director"', "waiting director maps to stable director state");
mustInclude(createRenderLocalUpdate, "scheduleRoomInspectorStablePatch(reason)", "room status updates use stable snapshots");
mustInclude(isRoomAutoSchedulingOnlyRenderReason, 'reason === "room_auto_turn_scheduled"', "scheduled auto turn is UI-no-op");
mustInclude(isRoomAutoSchedulingOnlyRenderReason, 'reason === "room_auto_turn_busy"', "busy auto turn is UI-no-op");
mustInclude(isRoomAutoSchedulingOnlyRenderReason, 'reason === "room_auto_no_runnable_work"', "no-runnable auto turn is UI-no-op");
mustInclude(isRoomAutoSchedulingOnlyRenderReason, 'reason === "room_auto_not_foreground"', "not-foreground auto turn is UI-no-op");
mustNotInclude(notifyRoomInspectorUpdated, 'queueRoomSurfaceUpdate("room_inspector_update", ["inspector"])', "inspector notify should not directly patch the rail");

if (failures.length) {
  console.error(`Room inspector stable snapshot validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room inspector stable snapshot validation passed.");

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
