import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");
const prompts = read("src/core/prompts.ts");

mustInclude(
  main,
  "function createRoleHandoffPendingFollowup",
  "role handoff should create a one-shot pending follow-up",
);
mustInclude(
  main,
  "function detectRoleHandoffTarget",
  "role handoff should detect natural name-based follow-up targets",
);
mustInclude(
  main,
  'source: "role"',
  "role handoff pending follow-up should be marked as role-sourced",
);
mustInclude(
  main,
  'reason: "role_handoff"',
  "role handoff pending follow-up should carry a distinct reason",
);
mustInclude(
  main,
  'nextMove: "role_turn"',
  "role handoff should dispatch a role turn",
);
mustInclude(
  main,
  "canRoleReceiveHandoffFromMessage",
  "role handoff should be visibility-gated",
);
mustInclude(
  main,
  "primeRoomAutoTimer(result.reason, false, roleHandoffFollowup",
  "continuous auto flow should pass role handoff into the next queued turn",
);
mustInclude(
  prompts,
  "You may naturally ask another visible character a question by name",
  "role prompt should allow natural soft handoff by name",
);
mustInclude(
  prompts,
  "Do not use backend scheduling language or @mentions",
  "role prompt should still forbid public backend scheduling syntax",
);

if (failures.length > 0) {
  console.error(`validate-role-handoff-intent failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-role-handoff-intent passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}
