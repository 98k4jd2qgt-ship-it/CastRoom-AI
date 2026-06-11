import fs from "node:fs";

const failures = [];
const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const guards = fs.readFileSync("src/core/roomRuleGuards.ts", "utf8");

const planDirectorTick = sliceFunction(scheduler, "planDirectorTick");

mustInclude(
  guards,
  "export function evaluateRoomRoleMessageForRuling",
  "role-message-specific action ruling gate",
);
mustInclude(
  guards,
  "Role message is conversational; no public Director ruling is needed.",
  "casual role dialogue is allowed without public ruling",
);
mustInclude(
  guards,
  "roleMessageMayNeedPublicRuling(text)",
  "role messages must pass a concrete action precheck",
);
mustInclude(
  planDirectorTick,
  'input.source === "role"',
  "Director tick distinguishes submitted role messages from user inputs",
);
mustInclude(
  planDirectorTick,
  "evaluateRoomRoleMessageForRuling",
  "Director tick uses the conservative role-message ruling gate",
);
mustNotInclude(
  planDirectorTick,
  "const actionCheck = evaluateRoomAction({",
  "Director tick must not run every source message through the user action gate",
);

if (failures.length) {
  console.error(`Director casual action ruling validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Director casual action ruling validation passed.");

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
