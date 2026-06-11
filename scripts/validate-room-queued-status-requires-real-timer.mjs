import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const failures = [];

const createStableRoomFlowLabel = sliceFunction(main, "createStableRoomFlowLabel");
const autoSpeechStatusLabel = sliceFunction(roomSurface, "autoSpeechStatusLabel");
const roomFlowDisplayText = sliceFunction(roomSurface, "roomFlowDisplayText");

mustInclude(createStableRoomFlowLabel, "nextTurnAt > Date.now()", "main stable label requires a future queued turn");
mustInclude(createStableRoomFlowLabel, "roomAutoTimer !== 0", "main stable label requires a registered timer");
mustInclude(createStableRoomFlowLabel, '"auto_recovering"', "missing or overdue timer is shown as recovering, not queued");
mustInclude(autoSpeechStatusLabel, "nextTurnAt > Date.now()", "UI auto label does not show queued for overdue turns");
mustInclude(roomFlowDisplayText, "nextTurnAt > Date.now()", "plan detail does not show queued for overdue turns");
mustInclude(main, 'ensureRoomAutoProgress("runtime_result")', "runtime result still triggers flow-driver recovery");

if (failures.length) {
  console.error(`Room queued status validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room queued status validation passed.");

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
