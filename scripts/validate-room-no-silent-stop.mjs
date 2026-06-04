import fs from "node:fs";

const types = fs.readFileSync("src/core/types.ts", "utf8");
const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const appState = fs.readFileSync("src/core/appState.ts", "utf8");
const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const copy = fs.readFileSync("src/ui/copy.ts", "utf8");
const failures = [];

mustInclude(types, "noResponseReason?: string", "schedule no-response reason");
mustInclude(types, "fallbackAction?: RoomFallbackAction", "schedule fallback action");
mustInclude(types, "lastNoResponseReason?: string | null", "room no-response diagnosis");
mustInclude(types, "lastFallbackAction?: RoomFallbackAction | null", "room fallback diagnosis");

mustInclude(scheduler, "function scheduleResultHasVisibleOutcome", "visible outcome detector");
mustInclude(scheduler, "function roomHardNoResponseReason", "hard no-response reason detector");
mustInclude(scheduler, "noResponseReason: hardReason", "hard stop records reason");
mustInclude(scheduler, 'fallbackAction: { action: "pause"', "pause fallback diagnosis");
mustInclude(scheduler, "pendingFollowup: fallback.pendingFollowup", "fallback produces pending follow-up");

mustInclude(appState, "lastNoResponseReason", "state stores no-response reason");
mustInclude(appState, "lastFallbackAction", "state stores fallback action");
mustInclude(roomSurface, "lastNoResponseReason", "inspector shows no-response reason");
mustInclude(roomSurface, "lastFallbackAction", "inspector shows fallback action");
mustInclude(copy, "lastNoResponseReason", "i18n no-response label");
mustInclude(copy, "lastFallbackAction", "i18n fallback label");

if (failures.length) {
  console.error(`Room no-silent-stop validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room no-silent-stop validation passed.");

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}
