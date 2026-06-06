import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");
const scheduler = read("src/core/roomScheduler.ts");

mustInclude(scheduler, "export function planDirectorTick", "scheduler should expose a lightweight Director tick");
mustInclude(main, "applyDirectorTickAfterMessage(userMessage, \"user\")", "user messages should be observed after action gates");
mustInclude(main, "applyDirectorTickAfterMessage(message, \"role\")", "role messages should be observed after role commit");
mustInclude(main, "planDirectorTick({", "main should call lightweight tick directly");
mustNotInclude(sliceFunction(main, "applyDirectorTickAfterMessage"), "await applyRoomDirectorTurnAsync", "Director tick must not call full Director LLM");
mustNotInclude(sliceFunction(main, "applyDirectorTickAfterMessage"), "await createLiveDirectorTurnPlan", "Director tick must not call live Director planner");

if (failures.length > 0) {
  console.error(`validate-director-tick-nonblocking failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-tick-nonblocking passed");

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

function mustNotInclude(text, marker, label) {
  if (text.includes(marker)) {
    failures.push(`${label}: unexpected ${marker}`);
  }
}
