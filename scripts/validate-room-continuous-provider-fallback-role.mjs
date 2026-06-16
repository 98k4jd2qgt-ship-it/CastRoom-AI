import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const applySchedule = sliceFunction(main, "applyRoomScheduleResultAsync");
const fallbackHelper = sliceFunction(main, "createProviderFallbackPendingFollowup");

mustInclude(applySchedule, "createProviderFallbackPendingFollowup(consoleState.room, result.participant.id)", "provider-empty branch asks for a fallback role");
mustInclude(applySchedule, "fallbackFollowup && isContinuousRoomFlow(consoleState.room)", "fallback is limited to continuous room flow");
mustInclude(applySchedule, "pendingFollowup: fallbackFollowup", "fallback role is scheduled as a one-shot follow-up");
mustInclude(applySchedule, "syncRoomAutoTimer()", "fallback role retry registers a real timer");
mustInclude(fallbackHelper, "getChannelVisibleRoleIds(room, room.activeChannelId)", "fallback respects channel visibility");
mustInclude(fallbackHelper, 'participant.viewportState !== "api_error"', "fallback skips roles already marked api_error");
mustInclude(fallbackHelper, 'reason: "provider_fallback"', "fallback is labelled for diagnostics");

if (failures.length) {
  console.error(`Room continuous provider fallback validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room continuous provider fallback validation passed.");

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
