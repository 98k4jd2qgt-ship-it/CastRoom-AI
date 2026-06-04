import fs from "node:fs";

function fail(message) {
  console.error(`[default-clean-state] ${message}`);
  process.exitCode = 1;
}

function requireIncludes(label, text, snippet) {
  if (!text.includes(snippet)) {
    fail(`${label} must include: ${snippet}`);
  }
}

function requireNotIncludes(label, text, snippet) {
  if (text.includes(snippet)) {
    fail(`${label} must not include: ${snippet}`);
  }
}

const appState = fs.readFileSync("src/core/appState.ts", "utf8");
const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");

const initialStart = appState.indexOf("export function createInitialConsoleState()");
const initialEnd = appState.indexOf("export function reduceConsoleState", initialStart);
const initialBlock = appState.slice(initialStart, initialEnd);

requireIncludes("createInitialConsoleState", initialBlock, "rooms: []");
requireIncludes("createInitialConsoleState", initialBlock, 'activeRoomId: ""');
requireNotIncludes("createInitialConsoleState", initialBlock, "rooms: [room]");
requireIncludes("createInitialConsoleState", initialBlock, "includeInitialRole: false");

const ensureStart = appState.indexOf("function ensureRoomCollection");
const ensureEnd = appState.indexOf("function createRoomInState", ensureStart);
const ensureBlock = appState.slice(ensureStart, ensureEnd);

requireIncludes("ensureRoomCollection", ensureBlock, "state.rooms.length === 0");
requireIncludes("ensureRoomCollection", ensureBlock, "rooms: []");
requireIncludes("ensureRoomCollection", ensureBlock, 'activeRoomId: ""');

const deleteStart = appState.indexOf("function deleteRoomInState");
const deleteEnd = appState.indexOf("function normalizePromptCenterView", deleteStart);
const deleteBlock = appState.slice(deleteStart, deleteEnd);

requireIncludes("deleteRoomInState", deleteBlock, "normalized.rooms.length <= 1");
requireIncludes("deleteRoomInState", deleteBlock, "const rooms: RoomState[] = []");
requireIncludes("deleteRoomInState", deleteBlock, 'activeRoomId: ""');
requireNotIncludes("deleteRoomInState", deleteBlock, "const rooms = [room]");
requireNotIncludes("deleteRoomInState", deleteBlock, "isOpen: true");

requireIncludes("roomSurface", roomSurface, "function renderEmptyRoomWorkspace");
requireIncludes("roomSurface", roomSurface, "function hasVisibleRooms");
requireIncludes("roomSurface", roomSurface, "if (hasVisibleRooms(props))");
requireIncludes("roomSurface", roomSurface, "room-list-empty");

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[default-clean-state] OK");
