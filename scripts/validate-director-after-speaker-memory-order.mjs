import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const applySchedule = sliceFunction(main, "applyRoomScheduleResultAsync");
const memoryIndex = applySchedule.indexOf("recordRoomMemoryAdapterResult(memoryResult)");
const directorIndex = applySchedule.indexOf("applyDirectorTickAfterMessage(message, \"role\")");

if (memoryIndex < 0) {
  failures.push("missing recordRoomMemoryAdapterResult(memoryResult)");
}
if (directorIndex < 0) {
  failures.push("missing applyDirectorTickAfterMessage(message, \"role\")");
}
if (memoryIndex >= 0 && directorIndex >= 0 && memoryIndex > directorIndex) {
  failures.push("Director tick runs before speaker memory write");
}

if (failures.length) {
  console.error(`Director after-speaker-memory order validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Director after-speaker-memory order validation passed.");

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
