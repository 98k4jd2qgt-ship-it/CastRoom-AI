import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const snapshotInterface = sliceBetween(main, "interface RoomInspectorStableSnapshot", "interface RoomSurfaceUpdateQueueState");
const createSnapshot = sliceFunction(main, "createRoomInspectorStableSnapshot");
const applyRoomRuntimeResult = sliceFunction(main, "applyRoomRuntimeResult");

mustInclude(main, "function commitRoomDiagnosticPatch", "diagnostic patch helper exists");
mustInclude(applyRoomRuntimeResult, "commitRoomDiagnosticPatch({", "runtime inspector patches use diagnostics");
mustInclude(main, 'commitRoomDiagnosticPatch({\n      currentFocus: detail', "repeated output skip is diagnostic-only");
mustInclude(main, 'commitRoomDiagnosticPatch({\n          currentFocus: focus', "runtime busy is diagnostic-only");
mustNotInclude(snapshotInterface, "recentPublicActivity", "stable snapshot excludes recent public activity");
mustNotInclude(createSnapshot, "simulation.currentFocus", "stable snapshot excludes stale diagnostic focus");
mustNotInclude(createSnapshot, "createRecentPublicActivityKey", "stable snapshot is not invalidated by every message");

if (failures.length) {
  console.error(`Room diagnostic patch validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room diagnostic patch validation passed.");

function sliceFunction(source, name) {
  const start = Math.max(source.indexOf(`function ${name}`), source.indexOf(`export function ${name}`));
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const nextExport = source.indexOf("\nexport function ", start + 1);
  const nextPlain = source.indexOf("\nfunction ", start + 1);
  const candidates = [nextExport, nextPlain].filter((index) => index >= 0);
  return candidates.length ? source.slice(start, Math.min(...candidates)) : source.slice(start);
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) {
    failures.push(`missing block start: ${startMarker}`);
    return "";
  }
  const end = source.indexOf(endMarker, start + startMarker.length);
  return end >= 0 ? source.slice(start, end) : source.slice(start);
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
