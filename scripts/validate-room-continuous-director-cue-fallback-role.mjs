import fs from "node:fs";

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const failures = [];

const fastPath = sliceFunction(scheduler, "shouldUseRoleFastPathForAutoDirectorPlan");
const scheduleRoomTurn = sliceFunction(scheduler, "scheduleRoomTurn");

mustInclude(fastPath, 'beatType === "director_cue"', "Director cue branch exists");
mustInclude(fastPath, "return true;", "ordinary Director cue falls back to role fast path");
mustInclude(scheduleRoomTurn, "autoDirectorPlanRoleFastPath", "scheduler detects cue fast path");
mustInclude(scheduleRoomTurn, "!autoDirectorPlanRoleFastPath", "scheduler avoids executing downgraded Director cue as a planned turn");
mustInclude(scheduleRoomTurn, "createAutonomousFallbackSpeechIntent(room, input, addressing, selectedSpeechIntent.reason)", "scheduler can recover ask_director as role fallback");
mustNotInclude(fastPath, 'mode !== "story" && mode !== "mystery"', "story/mystery cue exception");

if (failures.length) {
  console.error(`Room continuous Director cue fallback validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room continuous Director cue fallback validation passed.");

function sliceFunction(source, name) {
  const start = Math.max(source.indexOf(`function ${name}`), source.indexOf(`export function ${name}`));
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const nextExport = source.indexOf("\nexport function ", start + 1);
  const nextPlain = source.indexOf("\nfunction ", start + 1);
  const candidates = [nextExport, nextPlain].filter((index) => index >= 0);
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
