import fs from "node:fs";

const failures = [];
const main = fs.readFileSync("src/main.ts", "utf8");
const flushRoomSurfaceUpdateQueue = sliceFunction(main, "flushRoomSurfaceUpdateQueue");
const restoreConversationInputState = sliceFunction(main, "restoreConversationInputState");

mustInclude(flushRoomSurfaceUpdateQueue, "const timelineOnly = isTimelineOnlyRoomSurfaceUpdate(kinds)", "flush detects timeline-only room updates");
mustInclude(flushRoomSurfaceUpdateQueue, "const inputSnapshot = timelineOnly ? null : captureConversationInputSnapshot()", "timeline-only updates skip input snapshot capture");
mustInclude(flushRoomSurfaceUpdateQueue, "if (inputSnapshot) {\n    restoreConversationInputState(inputSnapshot);", "timeline-only updates skip input restore");
mustInclude(restoreConversationInputState, "const stability = conversationInputStability[latestTarget]", "restore uses a single current stability snapshot");
mustInclude(restoreConversationInputState, "const activeEditableInput = document.activeElement === input", "restore detects active input");
mustInclude(restoreConversationInputState, "const recentInput = Date.now() - stability.lastInputAt < 350", "restore protects recent typing");
mustInclude(restoreConversationInputState, "const recentComposition = Date.now() - stability.lastCompositionAt < 1_200", "restore protects recent IME composition");
mustInclude(restoreConversationInputState, "const shouldSkipValueWrite = activeEditableInput && (recentInput || recentComposition)", "restore skips value writes while input is active");
mustInclude(restoreConversationInputState, "if (!shouldSkipValueWrite && input.value !== draftValue)", "restore does not overwrite active/recent input value");
mustInclude(restoreConversationInputState, "if (!shouldSkipValueWrite) {\n        input.setSelectionRange(selectionStart, selectionEnd);", "restore does not move selection during active/recent input");

if (failures.length) {
  console.error(`Room input render stability validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room input render stability validation passed.");

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
