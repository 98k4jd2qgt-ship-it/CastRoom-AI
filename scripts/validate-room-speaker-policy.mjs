import fs from "node:fs";

const failures = [];

const types = fs.readFileSync("src/core/types.ts", "utf8");
const appState = fs.readFileSync("src/core/appState.ts", "utf8");
const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const surface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const copy = fs.readFileSync("src/ui/copy.ts", "utf8");
const prompts = fs.readFileSync("src/core/prompts.ts", "utf8");
const roomProfiles = fs.readFileSync("src/core/roomProfiles.ts", "utf8");

mustInclude(types, 'export type RoomSpeakerPolicy = "balanced" | "round_robin" | "spotlight" | "freeform"', "speaker policy type");
mustInclude(types, "export interface RoomSpeakerPolicySettings", "speaker policy settings interface");
mustInclude(types, "speakerPolicy?: RoomSpeakerPolicySettings", "room state speaker policy");
mustInclude(types, '{ type: "room.setSpeakerPolicy"; policy: RoomSpeakerPolicy }', "speaker policy action");

mustInclude(appState, "export const defaultRoomSpeakerPolicy", "default speaker policy");
mustInclude(appState, 'mode: "balanced"', "balanced default");
mustInclude(appState, "normalizeRoomSpeakerPolicy", "speaker policy normalization");
mustInclude(appState, "speakerPolicy: normalizeRoomSpeakerPolicy(room.speakerPolicy)", "runtime normalization");
mustInclude(appState, 'case "room.setSpeakerPolicy"', "speaker policy reducer");
mustInclude(appState, 'case "room.setSpeakerPolicyNumberField"', "speaker policy number reducer");
mustInclude(appState, 'case "room.setSpeakerPolicyBooleanField"', "speaker policy boolean reducer");

mustInclude(scheduler, "rankRoomSpeechIntent", "speaker policy scoring");
mustInclude(scheduler, "collectRoleParticipationStats", "participation stats");
mustInclude(scheduler, "isRecentPairLoop", "pair loop guard");
mustInclude(scheduler, "chooseParticipantBySpeakerPolicy", "fallback participant policy");
mustInclude(scheduler, "lurkerBoostAfterTurns", "lurker boost use");
mustInclude(scheduler, "maxConsecutivePairTurns", "pair threshold use");
mustInclude(scheduler, "recentSpeakerPenalty", "recent speaker penalty use");
mustInclude(scheduler, 'policy.mode === "freeform"', "freeform compatibility");
mustInclude(scheduler, 'policy.mode === "round_robin"', "round robin scoring");
mustInclude(scheduler, 'policy.mode === "spotlight"', "spotlight scoring");

const selectRoomSpeechTurn = sliceFunction(scheduler, "selectRoomSpeechTurn");
mustInclude(selectRoomSpeechTurn, "rankRoomSpeechIntent", "ranked speaker selection");
mustInclude(selectRoomSpeechTurn, "selectDirectedDebateSpeechIntent", "debate order remains first");
mustInclude(selectRoomSpeechTurn, "validateNextSpeakerEligibility", "visibility/debate eligibility preserved");

mustInclude(surface, "renderRoomSpeakerPolicyControl", "speaker policy UI");
mustInclude(surface, "ROOM_SPEAKER_POLICIES", "speaker policy UI options");
mustInclude(surface, 'type: "room.setSpeakerPolicy"', "speaker policy UI action");
mustInclude(surface, "room.setSpeakerPolicyNumberField", "advanced number UI action");
mustInclude(surface, "room.setSpeakerPolicyBooleanField", "advanced boolean UI action");
mustInclude(surface, "freedomLevel === \"developer\"", "advanced controls developer gate");

for (const key of [
  "speakerPolicy",
  "speakerPolicy_balanced",
  "speakerPolicy_round_robin",
  "speakerPolicy_spotlight",
  "speakerPolicy_freeform",
  "speakerPolicyMaxPair",
  "speakerPolicyLurkerBoost",
  "speakerPolicyRecentPenalty",
]) {
  mustInclude(copy, key, `copy key ${key}`);
}

mustInclude(prompts, "A long-silent role may naturally re-enter", "prompt long-silent re-entry");
mustInclude(prompts, "one role-specific angle instead of summarizing the whole thread", "role prompt re-entry damping");
mustInclude(roomProfiles, "long-silent roles may re-enter", "runtime profile re-entry");

if (failures.length) {
  console.error(`Room speaker policy validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room speaker policy validation passed.");

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
