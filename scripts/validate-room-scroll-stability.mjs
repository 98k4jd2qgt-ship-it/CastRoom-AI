import fs from "node:fs";

const failures = [];
const main = fs.readFileSync("src/main.ts", "utf8");

const restoreScrollSnapshot = sliceFunction(main, "restoreScrollSnapshot");
const scheduleConversationScrollToBottom = sliceFunction(main, "scheduleConversationScrollToBottom");
const restoreOrFollowConversationScroll = sliceFunction(main, "restoreOrFollowConversationScroll");
const restoreRoomSurfaceUiSnapshot = sliceFunction(main, "restoreRoomSurfaceUiSnapshot");
const render = sliceFunction(main, "render");
const flushRoomSurfaceUpdateQueue = sliceFunction(main, "flushRoomSurfaceUpdateQueue");

mustInclude(main, "let scrollRestoreFrameToken = 0;", "scroll restore token state");
mustInclude(main, "let scrollToBottomFrameToken = 0;", "scroll-to-bottom token state");
mustInclude(main, "let roomUiRestoreFrameToken = 0;", "room UI restore token state");
mustInclude(restoreScrollSnapshot, "const token = ++scrollRestoreFrameToken", "scroll restore invalidates older frames");
mustInclude(restoreScrollSnapshot, "token !== scrollRestoreFrameToken", "scroll restore skips stale frames");
mustInclude(scheduleConversationScrollToBottom, "const token = ++scrollToBottomFrameToken", "scroll bottom invalidates older frames");
mustInclude(scheduleConversationScrollToBottom, "token !== scrollToBottomFrameToken", "scroll bottom skips stale frames");
mustInclude(restoreRoomSurfaceUiSnapshot, "const token = ++roomUiRestoreFrameToken", "expandable UI restore invalidates older frames");
mustInclude(restoreOrFollowConversationScroll, "shouldFollowConversationScrollTarget", "single scroll strategy helper chooses follow vs restore");
mustInclude(render, "restoreOrFollowConversationScroll(scrollSnapshot, conversationScrollTarget)", "room full render uses one scroll strategy");
mustInclude(flushRoomSurfaceUpdateQueue, "restoreOrFollowConversationScroll(scrollSnapshot, conversationScrollTarget)", "room queued patch uses one scroll strategy");

if (failures.length) {
  console.error(`Room scroll stability validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room scroll stability validation passed.");

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
