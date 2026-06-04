import fs from "node:fs";

const visibility = fs.readFileSync("src/core/roomVisibility.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const types = fs.readFileSync("src/core/types.ts", "utf8");

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

mustInclude(visibility, "export function validateNoPrivateLeakToPublic", "leak guard export");
mustInclude(visibility, 'reason: "private_context_public_message"', "private context public guard");
mustInclude(visibility, 'reason: "private_channel_visibility_mismatch"', "private channel mismatch guard");
mustInclude(visibility, 'reason: "faction_channel_visibility_mismatch"', "faction channel mismatch guard");
mustInclude(visibility, 'input.triggerMessage?.visibility === "private_thread"', "private trigger detection");
mustInclude(visibility, 'input.triggerMessage?.visibility === "faction_huddle"', "faction trigger detection");

mustInclude(types, '"private_leak_blocked"', "room termination reason includes private leak block");

mustMatch(
  main,
  /const leakGuard = validateNoPrivateLeakToPublic\(\{[\s\S]*decision:\s*replyChannelDecision[\s\S]*triggerMessage:\s*lastRoomMessage/,
  "role leak guard uses trigger context",
);
mustMatch(
  main,
  /Room\.privateLeakGuard[\s\S]*private_leak_blocked/,
  "role leak guard records blocked state",
);
mustMatch(
  main,
  /const leakGuard = validateNoPrivateLeakToPublic\(\{[\s\S]*decision:\s*replyChannelDecision[\s\S]*triggerMessage/,
  "director leak guard uses trigger context",
);
mustMatch(
  main,
  /Room\.directorPrivateLeakGuard[\s\S]*private_leak_blocked/,
  "director leak guard records blocked state",
);
mustInclude(main, "validateRoomTimelineChannelVisibility", "commit-level visibility guard");
mustInclude(main, "Room.privateLeakCommitGuard", "commit-level diagnostic");
mustInclude(main, '"private_message_channel_missing"', "commit guard blocks missing private channel");

if (failures.length > 0) {
  console.error("validate-room-private-leak-guard failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-room-private-leak-guard passed");
