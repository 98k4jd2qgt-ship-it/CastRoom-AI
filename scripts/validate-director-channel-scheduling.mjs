import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");
const scheduler = read("src/core/roomScheduler.ts");
const collaboration = read("src/core/roomCollaborationPolicy.ts");
const memoryAdapter = read("src/core/roomMemoryAdapter.ts");
const roomSurface = read("src/ui/roomSurface.ts");

const directorTurnBlock = sliceFunction(main, "applyRoomDirectorTurn");
const noteBlock = sliceFunction(main, "createDirectorChannelMessage");
const commitGuardBlock = sliceFunction(main, "validateRoomTimelineChannelVisibility");

mustInclude(noteBlock, 'visibility: "director_channel"', "Director backstage note should use hidden visibility");
mustInclude(noteBlock, 'channelId: "director"', "Director backstage note should target director channel");
mustInclude(noteBlock, "isDirectorPublicSchedulingText(publicText)", "scheduling-like public text should be detected for backstage routing");
mustInclude(noteBlock, "compactDirectorChannelNote", "Director backstage note should use compact summaries");
mustInclude(main, "private: ${directiveTargets.join", "private directives should be summarized in compact director channel notes");
mustInclude(main, "sanitizeDirectorChannelNoteFocus", "Director Channel notes should sanitize developer-channel focus text");
mustInclude(main, "isPublicRoomPromptTimelineMessage", "Director prompt recent timeline should only use public room messages");
mustInclude(main, "previousDirectorNote?.text === note", "duplicate director channel notes should be deduped");
mustInclude(main, 'commitRoomTimelineMessage(directorChannelMessage, "room_director_channel_note")', "Director turn should commit backstage notes");
mustInclude(main, 'commitRoomTimelineMessage(message, "room_director_public_text")', "Director narration should still use public timeline commit");
mustInclude(commitGuardBlock, 'message.channelId === "director"', "commit guard should validate director channel id");
mustInclude(commitGuardBlock, 'message.visibility === "director_channel"', "commit guard should validate director visibility");
mustInclude(scheduler, "shouldCommitDirectorPublicText(plan)", "scheduler should preserve public narration gate");
mustInclude(scheduler, "isDirectorPublicSchedulingText(structuredOutcome.publicText)", "scheduler should block backend scheduling from public text");
mustInclude(scheduler, "latestPublicRoomMessage(room)", "scheduler should resolve latest public message instead of hidden backstage notes");
mustInclude(scheduler, "recentPublicRoomMessages(room", "scheduler should build recent context from public messages");
mustInclude(main, "latestRoomMessageForReplyChannel", "main reply routing should skip director channel notes");
mustInclude(collaboration, "latestNonDirectorChannelMessage(room.messages)", "collaboration policy should skip director channel notes");
mustInclude(memoryAdapter, 'message.visibility === "director_channel"', "memory adapter should special-case Director Channel messages");
mustInclude(memoryAdapter, "writtenScopes: [room.director.memoryScope]", "Director Channel memory should only write Director scope");
mustInclude(roomSurface, "publicRoomContextMessages(room, 3)", "public room context panel should filter hidden Director Channel messages");

if (failures.length > 0) {
  console.error(`validate-director-channel-scheduling failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-channel-scheduling passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

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
    failures.push(`${label}: missing ${marker}`);
  }
}
