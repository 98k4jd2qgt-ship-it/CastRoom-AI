import fs from "node:fs";

const failures = [];
const main = fs.readFileSync("src/main.ts", "utf8");

const notifyRoomSurfaceUpdated = sliceFunction(main, "notifyRoomSurfaceUpdated");
const notifyRoomInspectorUpdated = sliceFunction(main, "notifyRoomInspectorUpdated");
const flushRoomSurfaceUpdateQueue = sliceFunction(main, "flushRoomSurfaceUpdateQueue");
const render = sliceFunction(main, "render");
const requestRender = sliceFunction(main, "requestRender");
const applyRoomRuntimeResult = sliceFunction(main, "applyRoomRuntimeResult");

mustNotInclude(notifyRoomSurfaceUpdated, "ensureRoomAutoProgress", "surface notify should not trigger auto watchdog");
mustNotInclude(notifyRoomInspectorUpdated, "ensureRoomAutoProgress", "inspector notify should not trigger auto watchdog");
mustNotInclude(flushRoomSurfaceUpdateQueue, "ensureRoomAutoProgress", "queued UI flush should not trigger auto watchdog");
mustNotInclude(render, 'ensureRoomAutoProgress("room_render")', "full room render should not trigger auto watchdog");
mustNotInclude(requestRender, "ensureRoomAutoProgress", "render requests should not trigger auto watchdog");
mustNotInclude(requestRender, "queueRoomAutoProgressCheck", "render requests should not enqueue auto progress checks");
mustInclude(applyRoomRuntimeResult, 'ensureRoomAutoProgress("runtime_result")', "runtime result still repairs auto progress");

if (failures.length) {
  console.error(`Room auto UI feedback loop validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room auto UI feedback loop validation passed.");

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
