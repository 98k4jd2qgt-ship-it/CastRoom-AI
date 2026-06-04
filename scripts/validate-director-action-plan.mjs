import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[director-action-plan] ${message}`);
    process.exitCode = 1;
  }
}

const types = read("src/core/types.ts");
const scheduler = read("src/core/roomScheduler.ts");
const directorPolicy = read("src/core/directorModePolicy.ts");

for (const marker of [
  "export interface DirectorStructuredOutcome",
  "publicTextReason",
  "privateDirectives",
  "statePatch",
  "framePatch",
  "memoryWrites",
]) {
  assert(types.includes(marker) || scheduler.includes(marker), `Director structured action boundary missing ${marker}`);
}

assert(
  scheduler.includes("createDirectorStructuredOutcomeFromPlan") &&
    scheduler.includes("createFramePatchFromDirectorPlan") &&
    scheduler.includes("resolveRoomFrameInterpretation"),
  "Director structured outcome must carry frame interpretation into state patch",
);

assert(
  /privateDirectives[\s\S]{0,180}createDirectorPrivateDirectives/.test(scheduler),
  "Director plan must keep private directives separate from public text",
);

assert(
  directorPolicy.includes("RoomFrameInterpretation") && directorPolicy.includes("primary?.kind"),
  "Director mode policy must use interpreted primary/secondary intent signals",
);

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[director-action-plan] ok");
