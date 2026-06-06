import fs from "node:fs";

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const failures = [];

const scheduleRoomTurn = sliceFunction(scheduler, "scheduleRoomTurn");
const roleFastPath = sliceFunction(scheduler, "createAutonomousFallbackSpeechIntent");
const directorPlanFastPath = sliceFunction(scheduler, "shouldUseRoleFastPathForAutoDirectorPlan");

mustInclude(roleFastPath, "chooseNextParticipant(room", "role fast path chooses a visible participant");
mustInclude(roleFastPath, "autonomous_role_fallback", "role fast path marks autonomous fallback reason");
mustInclude(roleFastPath, 'target: "all"', "role fast path addresses the room, not @You");

mustInclude(directorPlanFastPath, 'turn.speakerType !== "director"', "plan fast path only applies to Director planned turns");
mustInclude(directorPlanFastPath, 'beatType === "director_judge"', "plan fast path preserves Director judgement");
mustInclude(directorPlanFastPath, 'beatType === "director_twist"', "plan fast path preserves Director twists");
mustInclude(directorPlanFastPath, 'beatType === "scene_shift"', "plan fast path preserves scene shifts");
mustInclude(directorPlanFastPath, 'mode !== "story" && mode !== "mystery"', "Director cue is only preserved as public narration in scene modes");

mustInclude(scheduleRoomTurn, "autoDirectorPlanRoleFastPath", "scheduler detects auto Director planned turns that should become role turns");
mustInclude(scheduleRoomTurn, "!autoDirectorPlanRoleFastPath", "scheduler skips executing downgraded Director planned turns");
mustInclude(scheduleRoomTurn, "createAutonomousFallbackSpeechIntent(room, input, addressing, selectedSpeechIntent.reason)", "auto ask_director intent is downgraded to role fast path");
mustInclude(scheduleRoomTurn, "createAutonomousFallbackSpeechIntent(room, input, addressing, \"no_speaker_intent\")", "auto no-speaker state uses role fast path");

mustNotInclude(scheduleRoomTurn, 'directorHandoff("waiting_user", room, nowMs + delayMs)', "auto waiting_user Director handoff");
mustNotInclude(scheduleRoomTurn, 'directorHandoff("burst_limit", room, nowMs + delayMs)', "auto burst_limit Director handoff");
mustNotInclude(scheduleRoomTurn, 'directorHandoff("repetition_guard", room, nowMs + delayMs)', "auto repetition_guard Director handoff");

if (failures.length) {
  console.error(`Room auto role fast path validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room auto role fast path validation passed.");

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
