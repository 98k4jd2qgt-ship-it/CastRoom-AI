import fs from "node:fs";

const visibility = fs.readFileSync("src/core/roomVisibility.ts", "utf8");
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

mustInclude(visibility, 'action: "public_safe_summary"', "public safe summary decision");
mustInclude(visibility, 'action: "public_action"', "public action decision");
mustMatch(
  visibility,
  /decision\.action === "public" \|\| decision\.action === "public_safe_summary" \|\| decision\.action === "public_action"[\s\S]*visibility:\s*"public"/,
  "only explicit public-safe decisions can force public visibility",
);
mustMatch(
  visibility,
  /\(triggerPrivate \|\| decisionKeepsPrivate\) && messagePublic/,
  "private trigger cannot accidentally become public",
);

mustInclude(main, "private_leak_blocked", "blocked private influence terminal state");
mustInclude(main, "triggerChannelId", "diagnostic records trigger channel");
mustInclude(main, "messageChannelId", "diagnostic records target channel");
mustInclude(main, "Private channel content was blocked before it could enter the wrong timeline.", "commit guard public impact text");

if (failures.length > 0) {
  console.error("validate-room-private-thread-public-impact failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-room-private-thread-public-impact passed");
