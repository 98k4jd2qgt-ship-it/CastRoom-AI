import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[room-frame-intent] ${message}`);
    process.exitCode = 1;
  }
}

const types = read("src/core/types.ts");
const appState = read("src/core/appState.ts");
const guards = read("src/core/roomRuleGuards.ts");
const scheduler = read("src/core/roomScheduler.ts");
const main = read("src/main.ts");
const roomSurface = read("src/ui/roomSurface.ts");
const packageJson = read("package.json");

for (const marker of [
  "export type RoomFrameIntentKind",
  "export type RoomFrameUserRole",
  "export type RoomFrameAbsorption",
  "export interface RoomFrameIntent",
  "export interface RoomFrameState",
  "export interface RoomFramePatch",
  "framePatch?: RoomFramePatch",
  "frame?: RoomFrameState",
  "frame: RoomFrameState",
  '{ type: "room.setFrameState"; frame: RoomFrameState }',
]) {
  assert(types.includes(marker), `types.ts missing ${marker}`);
}

for (const marker of [
  "defaultRoomFrameState",
  "normalizeRoomFrameState",
  "normalizeRoomFrameIntent",
  "frame: defaultRoomFrameState",
  "frame: normalizeRoomFrameState",
  'case "room.setFrameState"',
]) {
  assert(appState.includes(marker), `appState.ts missing ${marker}`);
}

for (const marker of [
  "resolveRoomFrameIntent",
  "FRAME_MODE_SHIFT_PATTERN",
  "FRAME_META_CONTROL_PATTERN",
  "world_edit_claim",
  "developer",
  "direct_apply",
  "wait_for_choice",
  "plot_transition",
]) {
  assert(guards.includes(marker), `roomRuleGuards.ts missing ${marker}`);
}

for (const marker of [
  "createFramePatchFromDirectorPlan",
  "applyFramePatch",
  "structuredOutcome.framePatch",
  "frame,",
  "resolveRoomFrameIntent",
]) {
  assert(scheduler.includes(marker), `roomScheduler.ts missing ${marker}`);
}

for (const marker of [
  "resolveRoomFrameIntent",
  "room.setFrameState",
  "buildRoomFrameIntentPromptBlock",
  "Frame intent:",
]) {
  assert(main.includes(marker), `main.ts missing ${marker}`);
}

for (const marker of [
  "frameItems",
  "frameIntentKindLabel",
  "frameUserRoleLabel",
  "frameAbsorptionLabel",
  "frameControl",
]) {
  assert(roomSurface.includes(marker), `roomSurface.ts missing ${marker}`);
}

assert(
  !/frameItems[\s\S]{0,500}message\.text/.test(roomSurface),
  "Frame Inspector must read structured room.frame state, not derive from timeline text",
);

assert(
  packageJson.includes("node scripts/validate-room-frame-intent.mjs"),
  "package.json check script must include validate-room-frame-intent.mjs",
);

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[room-frame-intent] ok");
