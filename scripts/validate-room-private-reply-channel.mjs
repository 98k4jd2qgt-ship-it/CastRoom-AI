import fs from "node:fs";

const visibility = fs.readFileSync("src/core/roomVisibility.ts", "utf8");
const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");

const failures = [];

function mustInclude(source, text, label) {
  if (!source.includes(text)) {
    failures.push(`${label}: missing ${text}`);
  }
}

function mustMatch(source, pattern, label) {
  if (!pattern.test(source)) {
    failures.push(`${label}: missing pattern ${pattern}`);
  }
}

mustInclude(visibility, "export type ReplyChannelDecision", "reply channel decision type");
mustInclude(visibility, 'action: "same_private_thread"', "private reply decision");
mustInclude(visibility, 'reason: "trigger_private_thread"', "private trigger inheritance");
mustInclude(visibility, 'reason: "active_private_thread"', "active private channel inheritance");
mustInclude(visibility, "privateThreadVisibleTargets(thread)", "private thread visibility target");
mustInclude(visibility, "applyReplyChannelDecisionToMessage", "reply decision application");
mustMatch(
  visibility,
  /visibility:\s*"private_thread"[\s\S]*channelId:\s*decision\.channelId/,
  "private decision applies private thread channel",
);

mustInclude(scheduler, "resolveReplyChannelDecision", "scheduler re-export resolve helper");
mustInclude(scheduler, "applyReplyChannelDecisionToMessage", "scheduler re-export apply helper");
mustInclude(scheduler, "validateNoPrivateLeakToPublic", "scheduler re-export leak guard");

mustMatch(
  main,
  /resolveReplyChannelDecision\(\{[\s\S]*triggerMessage:\s*lastRoomMessage[\s\S]*draftMessage/,
  "role reply resolves from trigger message",
);
mustMatch(
  main,
  /const channelScopedDraft = applyReplyChannelDecisionToMessage\(draftMessage, replyChannelDecision\);[\s\S]*resolveRoomMessageVisibility\(channelScopedDraft/,
  "role reply applies decision before visibility resolution",
);
mustMatch(
  main,
  /resolveReplyChannelDecision\(\{[\s\S]*triggerMessage,[\s\S]*draftMessage:\s*result\.message/,
  "director reply resolves from trigger message",
);
mustMatch(
  main,
  /const channelScopedDirectorMessage = applyReplyChannelDecisionToMessage\(result\.message, replyChannelDecision\);[\s\S]*resolveRoomMessageVisibility\(channelScopedDirectorMessage/,
  "director reply applies decision before visibility resolution",
);

if (failures.length > 0) {
  console.error("validate-room-private-reply-channel failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-room-private-reply-channel passed");
