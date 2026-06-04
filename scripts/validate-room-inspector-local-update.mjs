import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const createRenderLocalUpdate = sliceFunction(main, "createRenderLocalUpdate");
mustInclude(createRenderLocalUpdate, 'workspace === "room"', "Room workspace has a local update path");
mustInclude(createRenderLocalUpdate, 'options.kind === "message"', "message updates keep using the full non-input Room refresh");
mustInclude(createRenderLocalUpdate, "return notifyRoomSurfaceUpdated", "message updates can refresh timeline-bearing Room regions");
mustInclude(createRenderLocalUpdate, "return notifyRoomInspectorUpdated", "status/diagnostic updates use the Inspector local refresh");

const inspectorUpdate = sliceFunction(main, "notifyRoomInspectorUpdated");
mustInclude(inspectorUpdate, 'querySelector<HTMLElement>(".room-control-rail")', "Inspector update targets the right rail");
mustInclude(inspectorUpdate, 'currentRail.replaceWith(nextRail)', "Inspector update replaces only the right rail inside main content");
mustInclude(inspectorUpdate, '[".room-surface-topbar", ".room-role-strip"]', "Inspector update keeps topbar and role status fresh");
mustNotInclude(inspectorUpdate, '".room-surface-main"', "status updates must not replace the full Room main region");
mustNotInclude(inspectorUpdate, "scheduleConversationScrollToBottom", "status updates must not scroll the timeline to bottom");
mustNotInclude(inspectorUpdate, "markRenderedSurface", "status updates must not mark timeline message counts as rendered");

const fullUpdate = sliceFunction(main, "notifyRoomSurfaceUpdated");
mustInclude(fullUpdate, '".room-surface-main"', "message updates may replace the main region");
mustInclude(fullUpdate, "scheduleConversationScrollToBottom", "message updates still scroll the timeline when appropriate");

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
