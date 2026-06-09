import fs from "node:fs";

function fail(message) {
  console.error(`Room prompt token budget validation failed:\n- ${message}`);
  process.exit(1);
}

function mustInclude(text, marker, message) {
  if (!text.includes(marker)) fail(`${message}: ${marker}`);
}

const main = fs.readFileSync("src/main.ts", "utf8");
const memory = fs.readFileSync("src/core/memory.ts", "utf8");

mustInclude(main, "function roomContextBudgetLimits", "prompt budget limits helper exists");
mustInclude(main, "recentTimeline: 4", "compact budget lowers recent timeline");
mustInclude(main, "recentTimeline: 4", "balanced budget uses compact recent timeline by default");
mustInclude(main, "recentTimeline: 10", "full budget preserves larger recent timeline");
mustInclude(main, "slice(-budget.recentTimeline)", "role prompt timeline uses budget");
mustInclude(main, "budget.timelineChars", "role prompt line length uses budget");
mustInclude(main, 'identityCardScope: "speaker"', "balanced budget only injects current speaker identity");
mustInclude(main, 'includePlotFrameMode: "complex"', "balanced budget includes plot/frame only for complex turns");
mustInclude(main, "roomIdentityCardParticipants(consoleState.room, participant, budget)", "role prompt identity cards use budget scope");
mustInclude(main, "shouldIncludePlotFrameInRoomPrompt(consoleState.room, result, budget)", "role prompt plot/frame injection is gated");
mustInclude(main, "function buildCompactRoomSpeakerPrompt", "compact room speaker prompt exists");
mustInclude(main, 'path: useLocalSpeakerPrompt ? "local_compact" : useCompactSpeakerPrompt ? "compact" : "full"', "speaker diagnostics distinguish local compact, cloud compact, and full prompt paths");
mustInclude(main, "Generate one room message for ${participant.name}", "compact cloud prompt uses a short speaker-only prompt");
mustInclude(main, "Director graph memory: omitted for this lightweight Director pass.", "lightweight Director pass omits graph memory");
mustInclude(main, "Local rule plan summary: ${JSON.stringify(compactDirectorLocalPlanForPrompt(localPlan))}", "lightweight Director pass uses compact local plan summary");
mustInclude(main, "recentTimelineLimit = useFullDirectorContext ? budget.recentTimeline : Math.min(4, budget.recentTimeline)", "lightweight Director pass reduces timeline length");
mustInclude(memory, 'options: { budget?: "compact" | "balanced" | "full" }', "room prompt memory accepts budget option");
mustInclude(memory, 'budget === "compact"', "room prompt memory has compact limits");
mustInclude(memory, 'budget === "full"', "room prompt memory has full limits");

console.log("Room prompt token budget validation passed.");
