import fs from "node:fs";

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const plannedTurnTarget = sliceFunction(scheduler, "plannedTurnTarget");
mustInclude(plannedTurnTarget, 'intent === "group_opinion" || intent === "debate_round"', "group/debate planned turns are handled explicitly");
mustInclude(plannedTurnTarget, 'return "all";', "group/debate planned turns address the room");
mustInclude(plannedTurnTarget, 'intent === "direct_mention"', "public @role planned turns are handled explicitly");
mustInclude(
  plannedTurnTarget,
  'return { targets: [{ type: "user", userId: room.userProfile.userId }] };',
  "public @role planned turns answer the user while staying public",
);

const chooseTurnTarget = sliceFunction(scheduler, "chooseTurnTarget");
mustInclude(chooseTurnTarget, 'if (trigger === "user")', "real user-triggered turns can still answer the user");
mustInclude(chooseTurnTarget, 'return "all";', "auto target fallback addresses the room");

const normalizePromptTarget = sliceFunction(main, "normalizeRoomSpeakerPromptTarget");
mustInclude(normalizePromptTarget, 'result.reason === "user_reply" || result.reason === "user_follow_up"', "real user chains keep user targets");
mustInclude(normalizePromptTarget, 'return "all";', "non-user auto user targets normalize to All");

const providerPrompt = sliceFunction(main, "buildRoomProviderPrompt");
const localPrompt = sliceFunction(main, "buildLocalRoomSpeakerPrompt");
mustInclude(providerPrompt, "normalizeRoomSpeakerPromptTarget(result, userInput)", "cloud room prompt normalizes target");
mustInclude(localPrompt, "normalizeRoomSpeakerPromptTarget(result, userInput)", "local room prompt normalizes target");

const cloudPlannerGate = sliceFunction(main, "shouldUseCloudRoomPlanner");
mustInclude(cloudPlannerGate, 'fallback.intent === "group_opinion" && mode === "casual"', "casual group opinion skips cloud planner");

const directiveSanitizer = sliceFunction(main, "sanitizeDirectorPrivateDirectives");
mustInclude(directiveSanitizer, "sanitizeDirectorDirectiveTarget(candidate.target, room)", "live Director directive target is sanitized");
mustInclude(main, "function sanitizeDirectorDirectiveTarget", "Director directive target sanitizer exists");

if (failures.length) {
  console.error(`Room auto target normalization validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room auto target normalization validation passed.");

function sliceFunction(source, name) {
  const match = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  const start = match?.index ?? -1;
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const candidates = ["\nfunction ", "\nexport function ", "\nasync function ", "\ninterface "]
    .map((marker) => source.indexOf(marker, start + 1))
    .filter((index) => index >= 0);
  const next = candidates.length ? Math.min(...candidates) : -1;
  return next < 0 ? source.slice(start) : source.slice(start, next);
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
