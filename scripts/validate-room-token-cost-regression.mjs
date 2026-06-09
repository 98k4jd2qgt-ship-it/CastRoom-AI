import fs from "node:fs";

function fail(message) {
  console.error(`Room token cost regression validation failed:\n- ${message}`);
  process.exit(1);
}

function mustInclude(text, marker, message) {
  if (!text.includes(marker)) fail(`${message}: ${marker}`);
}

function mustNotInclude(text, marker, message) {
  if (text.includes(marker)) fail(`${message}: ${marker}`);
}

const main = fs.readFileSync("src/main.ts", "utf8");
const budgetStart = main.indexOf("function roomContextBudgetLimits");
const budgetEnd = main.indexOf("function", budgetStart + 1);
const budgetBlock = budgetStart >= 0 && budgetEnd > budgetStart ? main.slice(budgetStart, budgetEnd) : "";
const speakerStart = main.indexOf("function buildRoomProviderPrompt");
const speakerEnd = main.indexOf("function buildLocalRoomSpeakerPrompt", speakerStart);
const speakerBlock = speakerStart >= 0 && speakerEnd > speakerStart ? main.slice(speakerStart, speakerEnd) : "";
const compactStart = main.indexOf("function buildCompactRoomSpeakerPrompt");
const compactEnd = main.indexOf("function shouldUseCompactRoomSpeakerPrompt", compactStart);
const compactBlock = compactStart >= 0 && compactEnd > compactStart ? main.slice(compactStart, compactEnd) : "";

mustInclude(budgetBlock, "recentTimeline: 4", "balanced budget should keep recent timeline short");
mustInclude(budgetBlock, "timelineChars: 120", "balanced budget should cap each timeline line");
mustInclude(budgetBlock, "roomMemory: 2", "balanced budget should keep room memory short");
mustInclude(budgetBlock, "roleMemory: 1", "balanced budget should keep role memory short");
mustInclude(budgetBlock, 'identityCardScope: "speaker"', "balanced budget should not inject all identity cards");
mustInclude(budgetBlock, 'includePlotFrameMode: "complex"', "balanced budget should gate plot/frame on complex turns");
mustInclude(speakerBlock, "roomIdentityCardParticipants", "full prompt should still respect identity card scope");
mustInclude(speakerBlock, "shouldIncludePlotFrameInRoomPrompt", "full prompt should still gate plot/frame by turn complexity");
mustNotInclude(speakerBlock, "budget.includeIdentityCards ? consoleState.room.participants : [participant]", "old all-identity-card ternary should not return");
mustInclude(compactBlock, "Generate one room message", "compact prompt should have its own short cloud prompt shape");
mustNotInclude(compactBlock, "compileLayeredPrompt", "compact prompt must not assemble layered prompts");
mustNotInclude(compactBlock, "buildLocalRoomSpeakerPrompt", "compact prompt must not alias the local prompt");
mustNotInclude(compactBlock, "buildIdentityCardPromptBlock", "compact prompt must not inject identity cards");
mustNotInclude(compactBlock, "buildCompactPlotArcLine", "compact prompt must not inject plot state");
mustNotInclude(compactBlock, "Frame:", "compact prompt must not inject frame state");
mustInclude(main, "formatAiRequestPurposeAverageLines", "token audit should expose purpose-level averages");
mustInclude(main, "promptChars: roomPrompt.length", "prompt path diagnostics should record size only");
mustNotInclude(main, "promptText: roomPrompt", "diagnostics must not store full room prompt text");

console.log("Room token cost regression validation passed.");
