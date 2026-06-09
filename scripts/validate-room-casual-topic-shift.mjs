import fs from "node:fs";

function fail(message) {
  console.error(`Room casual topic shift validation failed:\n- ${message}`);
  process.exit(1);
}

function mustInclude(text, marker, message) {
  if (!text.includes(marker)) fail(`${message}: ${marker}`);
}

function mustNotInclude(text, marker, message) {
  if (text.includes(marker)) fail(`${message}: ${marker}`);
}

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const prompts = fs.readFileSync("src/core/prompts.ts", "utf8");
const profiles = fs.readFileSync("src/core/roomProfiles.ts", "utf8");
const copy = fs.readFileSync("src/ui/copy.ts", "utf8");
const types = fs.readFileSync("src/core/types.ts", "utf8");

const helperStart = scheduler.indexOf("function createCasualTopicShiftSpeechIntent");
const helperEnd = scheduler.indexOf("function shouldUseRoleFastPathForAutoDirectorPlan", helperStart);
const helperBlock = helperStart >= 0 && helperEnd > helperStart ? scheduler.slice(helperStart, helperEnd) : "";
const compactStart = main.indexOf("function buildCompactRoomSpeakerPrompt");
const compactEnd = main.indexOf("function shouldUseCompactRoomSpeakerPrompt", compactStart);
const compactBlock = compactStart >= 0 && compactEnd > compactStart ? main.slice(compactStart, compactEnd) : "";

mustInclude(types, '| "casual_topic_shift"', "casual topic shift is a first-class schedule reason");
mustInclude(scheduler, "function shouldUseCasualTopicShift", "scheduler has a casual-only topic shift gate");
mustInclude(scheduler, 'resolveDirectorMode(room) === "casual"', "topic shift is limited to casual mode");
mustInclude(scheduler, "function createCasualTopicShiftSpeechIntent", "scheduler can create topic-shift speech intents");
mustInclude(helperBlock, "chooseNextParticipant(room", "topic shift still uses room speaker policy via normal participant selection");
mustInclude(helperBlock, 'target: "all"', "topic shift addresses the room, not the user");
mustInclude(helperBlock, "casual_topic_shift ${reason}", "topic shift preserves the underlying fallback reason");
mustInclude(scheduler, 'createCasualTopicShiftSpeechIntent(room, input, addressing, "no_speaker_intent")', "no-speaker auto state creates a topic-shift opportunity");
mustInclude(scheduler, 'createCasualTopicShiftSpeechIntent(room, input, addressing, "question_loop")', "question-loop auto state can become a topic-shift opportunity");
mustInclude(scheduler, 'createCasualTopicShiftSpeechIntent(room, input, addressing, "repetition_guard")', "repetition guard can become a topic-shift opportunity");
mustNotInclude(helperBlock, "{ type: \"user\"", "topic shift must not schedule the user");
mustNotInclude(helperBlock, "@You", "topic shift helper must not mention @You");

mustInclude(compactBlock, "casualTopicShift", "compact prompt detects casual topic shift");
mustInclude(compactBlock, "The casual room needs a fresh topic", "compact prompt gives the minimal fresh-topic task");
mustInclude(compactBlock, "Follow Room Rules and this role's style", "topic shift prompt delegates style to Room Rules and role style");
mustInclude(compactBlock, "natural jump if the rules allow it", "topic shift prompt does not hard-code close-only topics");
mustNotInclude(compactBlock, "topic library", "compact prompt must not contain a fixed topic library");
mustNotInclude(compactBlock, "Director Script", "topic shift compact prompt must not inject Director Script");

mustInclude(prompts, "introduce a fresh topic when the room goes quiet or repetitive", "default casual Room Rules permit fresh-topic recovery");
mustInclude(prompts, "Follow the Room Rules for how far topic shifts may jump", "default templates make topic distance prompt-controllable");
mustInclude(prompts, "If selected to revive a quiet room", "role notes include quiet-room revival guidance");
mustNotInclude(prompts, "Wait for user direction when there is no visible next step", "default casual prompt no longer requires waiting on unclear casual flow");
mustNotInclude(prompts, "Pause on repetition, unavailable model", "default casual stop conditions no longer pause on ordinary repetition first");
mustInclude(profiles, "revive quiet/repetitive casual chat with one fresh topic within Room Rules", "room profile summary includes prompt-controlled topic shift");
mustInclude(copy, "When quiet or repetitive, a role may introduce a fresh topic within Room Rules.", "English Prompt Center hint avoids pause-first guidance");
mustInclude(copy, "安静或重复时，角色可以在房间规则内抛出新话题。", "Chinese Prompt Center hint avoids pause-first guidance");
mustNotInclude(copy, "Pause if unclear or repetitive.", "old pause-first hint was removed");
mustNotInclude(copy, "不清楚或重复时暂停。", "old Chinese pause-first hint was removed");

console.log("Room casual topic shift validation passed.");
