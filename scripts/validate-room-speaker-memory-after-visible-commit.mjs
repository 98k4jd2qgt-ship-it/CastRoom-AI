import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const applySchedule = sliceFunction(main, "applyRoomScheduleResultAsync");

mustOrdered(
  applySchedule,
  [
    "const speakerCommitResult = commitRoomTimelineMessage(message, \"room_speaker_message\")",
    "const speakerVisibleCommitted = isVisibleRoomTimelineCommit(speakerCommitResult)",
    "markRoomProviderTurnVisibleCommitted(providerTurn)",
    "scheduleRoomTimelineCommitFlush(message.id, \"room_speaker_message\")",
    "const memoryResult = roomMemoryAdapter.recordSpeakerMessage({",
    "recordRoomMemoryAdapterResult(memoryResult)",
    "applyDirectorTickAfterMessage(message, \"role\")",
  ],
  "speaker visible commit -> memory write -> Director observation order",
);

mustInclude(applySchedule, "recordRoomMemoryAdapterResult(memoryResult)", "speaker memory adapter result is persisted/refreshed");
mustInclude(applySchedule, "applyDirectorTickAfterMessage(message, \"role\")", "Director observes only after visible role message path");

if (failures.length) {
  console.error(`Room speaker memory-after-commit validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room speaker memory-after-commit validation passed.");

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

function mustOrdered(text, markers, label) {
  let cursor = -1;
  for (const marker of markers) {
    const index = text.indexOf(marker, cursor + 1);
    if (index < 0) {
      failures.push(`missing ordered marker for ${label}: ${marker}`);
      return;
    }
    cursor = index;
  }
}
