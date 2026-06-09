import fs from "node:fs";

function fail(message) {
  console.error(`Room context budget validation failed:\n- ${message}`);
  process.exit(1);
}

function mustInclude(text, marker, message) {
  if (!text.includes(marker)) fail(`${message}: ${marker}`);
}

const types = fs.readFileSync("src/core/types.ts", "utf8");
const appState = fs.readFileSync("src/core/appState.ts", "utf8");
const persistence = fs.readFileSync("src/core/persistence.ts", "utf8");
const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const copy = fs.readFileSync("src/ui/copy.ts", "utf8");

mustInclude(types, 'export type RoomContextBudget = "compact" | "balanced" | "full"', "RoomContextBudget union exists");
mustInclude(types, "contextBudget?: RoomContextBudget", "RoomState stores contextBudget");
mustInclude(types, 'type: "room.setContextBudget"', "context budget action exists");
mustInclude(appState, 'defaultRoomContextBudget: RoomContextBudget = "balanced"', "default context budget is balanced");
mustInclude(appState, "normalizeRoomContextBudget", "context budget is normalized");
mustInclude(persistence, "contextBudget: persistedRoom.contextBudget ?? base.room.contextBudget", "active room restore preserves context budget");
mustInclude(roomSurface, "renderRoomContextBudgetControl", "room UI renders context budget control");
mustInclude(copy, "contextBudget_compact", "context budget copy keys exist");

console.log("Room context budget validation passed.");
