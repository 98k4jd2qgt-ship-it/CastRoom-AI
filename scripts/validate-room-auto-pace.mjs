import fs from "node:fs";

const failures = [];

const types = fs.readFileSync("src/core/types.ts", "utf8");
const appState = fs.readFileSync("src/core/appState.ts", "utf8");
const roomProfiles = fs.readFileSync("src/core/roomProfiles.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const surface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const copy = fs.readFileSync("src/ui/copy.ts", "utf8");
const persistence = fs.readFileSync("src/core/persistence.ts", "utf8");

mustInclude(types, 'export type RoomAutoPacePreset = "fast" | "natural" | "slow" | "custom"', "auto pace preset type");
mustInclude(types, "export interface RoomAutoPaceSettings", "auto pace settings interface");
mustInclude(types, "autoPace?: RoomAutoPaceSettings", "room stores auto pace settings");
mustInclude(types, 'type: "room.setAutoPacePreset"', "auto pace preset action");
mustInclude(types, 'type: "room.setAutoPaceNumberField"', "auto pace number action");
mustInclude(types, 'type: "room.setAutoPaceRandomize"', "auto pace randomize action");

mustInclude(appState, "export const defaultRoomAutoPaceSettings", "default auto pace settings");
mustInclude(appState, 'preset: "natural"', "natural default preset");
mustInclude(appState, "minDelayMs: 3_000", "natural min delay");
mustInclude(appState, "maxDelayMs: 8_000", "natural max delay");
mustInclude(appState, "idleFillDelayMs: 12_000", "natural idle fill delay");
mustInclude(appState, "normalizeRoomAutoPaceSettings", "auto pace normalization");
mustInclude(appState, 'if (preset !== "custom")', "non-custom auto pace presets ignore stale custom timing values");
mustInclude(appState, "return { ...roomAutoPacePresetSettings[preset] }", "preset auto pace normalization returns preset timings");
mustInclude(appState, "autoPace: { ...defaultRoomAutoPaceSettings }", "new room stores default auto pace");
mustInclude(appState, "autoPace: normalizeRoomAutoPaceSettings(room.autoPace)", "runtime normalizes old rooms");
mustInclude(appState, 'case "room.setAutoPacePreset"', "auto pace preset reducer");
mustInclude(appState, 'case "room.setAutoPaceNumberField"', "auto pace number reducer");
mustInclude(appState, 'case "room.setAutoPaceRandomize"', "auto pace randomize reducer");

mustInclude(persistence, "autoPace: persistedRoom.autoPace ?? base.room.autoPace", "active room restore keeps auto pace");
mustInclude(persistence, "autoPace: room.autoPace ?? baseRoom.autoPace", "room collection restore keeps auto pace");

mustInclude(roomProfiles, "export function getRoomAutoTimerDelayMs", "auto timer delay helper");
mustInclude(roomProfiles, 'export type RoomAutoTimerDelayMode = "base" | "idle_gap"', "auto timer delay mode is explicit");
mustInclude(roomProfiles, 'delayMode === "idle_gap"', "idle gap uses idle fill delay only when requested");
mustInclude(roomProfiles, "pace.randomize === false", "randomize false uses fixed min delay");
mustInclude(roomProfiles, "randomDelayMs", "randomized delay helper");

mustInclude(main, "getRoomAutoTimerDelayMs", "main imports auto timer delay");
mustInclude(main, 'action.type === "room.setAutoPacePreset"', "auto pace change reprimes timer");
mustInclude(main, 'action.type === "room.setAutoPaceNumberField"', "auto pace numeric change reprimes timer");
mustInclude(main, 'action.type === "room.setAutoPaceRandomize"', "auto pace randomize change reprimes timer");
mustInclude(main, 'delayMode?: "base" | "idle_gap"; delayMs?: number', "prime timer supports explicit delay modes and direct retry delays");
mustInclude(main, 'delayMode: "base"', "auto pace change reprimes next tick with base delay");
mustInclude(main, "options.delayMs ?? getRoomAutoTimerDelayMs", "prime timer can override delay for immediate dispatch and internal retries");
mustInclude(main, "shouldScheduleContinuousRoomFlowAfterVisibleTurn", "continuous room flow reprimes after visible speaker turns");
mustInclude(main, 'primeRoomAutoTimer(result.reason, false, undefined, { delayMode: "base" })', "continuous room flow delay starts after message commit");
mustInclude(main, 'primeRoomAutoTimer("idle_auto", true, undefined, { delayMs: 0 })', "starting Room Flow dispatches immediately instead of waiting for the base delay");
mustInclude(main, 'primeRoomAutoTimer("director_followup", false, pending, { delayMode: "base" })', "runtime pending followups use base delay");
mustInclude(main, 'delayMs: 250', "active runtime overlap uses a short retry instead of the user-facing pace delay");
mustNotInclude(main, 'shouldUseLocalRoomFlowProfile()', "starting Room Flow should not force local model rooms back to slow speed");
mustInclude(main, 'fallback.intent === "single_reply"', "ordinary single replies skip cloud planner");
mustInclude(main, 'fallback.intent === "auto_simulation" && mode === "casual"', "casual auto simulation skips cloud planner");
mustInclude(main, 'fallback.intent === "group_opinion" && mode === "casual"', "casual group opinion skips cloud planner");
mustInclude(main, 'consoleTurnEngine.activeTurn?.status === "pending"', "active turn overlap guard");
mustInclude(main, 'requestRender("room_auto_turn_busy"', "busy auto tick is visible status, not waiting_user");
mustInclude(main, "function ensureRoomAutoProgress", "continuous room flow has timer watchdog");
mustInclude(main, 'autoSpeechState.status !== "cooling_down"', "timer watchdog only repairs queued auto turns");
mustInclude(main, 'autoSpeechState.nextTurnAt <= Date.now()', "timer watchdog repairs stale next-turn timestamps");
mustInclude(main, 'roomAutoTimer = 0;', "auto timer callback clears stale timer handle");
mustNotInclude(main, 'ensureRoomAutoProgress("room_render")', "room render should not re-enter auto watchdog");
mustNotInclude(main, 'ensureRoomAutoProgress("room_surface_update")', "room message local updates should not re-enter auto watchdog");
mustNotInclude(main, 'ensureRoomAutoProgress("room_inspector_update")', "room inspector local updates should not re-enter auto watchdog");

mustInclude(surface, "renderRoomAutoPaceControl", "auto pace UI");
mustInclude(surface, "ROOM_AUTO_PACE_PRESETS", "auto pace UI presets");
mustInclude(surface, 'type: "room.setAutoPacePreset"', "auto pace preset UI action");
mustInclude(surface, 'type: "room.setAutoPaceNumberField"', "auto pace number UI action");
mustInclude(surface, "msToSeconds", "auto pace displays seconds");
mustInclude(surface, "secondsToMs", "auto pace stores milliseconds");
mustInclude(surface, 'if (settings.preset === "custom")', "auto pace custom-only numeric controls");
mustInclude(surface, "wrapper.append(preset);", "auto pace default only shows preset selector");
mustNotInclude(surface, 'roomUiText(language, "autoPaceRandomize")', "visible auto pace randomize control");
mustNotInclude(surface, 'type: "room.setAutoPaceRandomize", randomize:', "auto pace randomize UI action");

for (const key of [
  "autoPace",
  "autoPace_fast",
  "autoPace_natural",
  "autoPace_slow",
  "autoPace_custom",
  "autoPaceMinDelay",
  "autoPaceMaxDelay",
  "autoPaceIdleFill",
  "autoPaceRandomize",
]) {
  mustInclude(copy, key, `copy key ${key}`);
}
mustInclude(copy, 'autoWaitingNextTurn: "Next auto turn is queued"', "English cooling text says queued, not waiting");
mustInclude(copy, 'autoWaitingNextTurn: "下一轮自动推演已排队"', "Chinese cooling text says queued, not blocked");

if (failures.length) {
  console.error(`Room auto pace validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room auto pace validation passed.");

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
