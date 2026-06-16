import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const executeRoomInput = sliceFunction(main, "executeRoomInput");

mustInclude(executeRoomInput, 'recordRoomMessageMemory(userMessage, "user", [], { recordObservations: false })', "public user message is recorded before scheduling");
mustInclude(executeRoomInput, "createRoomPlannerResult({", "public user message still enters room planning");
mustInclude(executeRoomInput, "scheduleRoomTurn({", "public user message schedules a role turn");
mustInclude(executeRoomInput, "applyRoomScheduleResultViaRuntime(scheduled, input, \"user\")", "scheduled role turn is applied after user input");
mustNotInclude(executeRoomInput, 'applyDirectorTickAfterMessage(userMessage, "user")', "passive Director tick before role reply");

if (failures.length) {
  console.error(`Room user message role-priority validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room user message role-priority validation passed.");

function sliceFunction(source, name) {
  const start = Math.max(source.indexOf(`function ${name}`), source.indexOf(`async function ${name}`));
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const nextAsync = source.indexOf("\nasync function ", start + 1);
  const nextPlain = source.indexOf("\nfunction ", start + 1);
  const candidates = [nextAsync, nextPlain].filter((index) => index >= 0);
  return candidates.length ? source.slice(start, Math.min(...candidates)) : source.slice(start);
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
