import fs from "node:fs";

function fail(message) {
  console.error(`Room compact speaker prompt validation failed:\n- ${message}`);
  process.exit(1);
}

function mustInclude(text, marker, message) {
  if (!text.includes(marker)) fail(`${message}: ${marker}`);
}

function mustNotInclude(text, marker, message) {
  if (text.includes(marker)) fail(`${message}: ${marker}`);
}

const main = fs.readFileSync("src/main.ts", "utf8");
const compactStart = main.indexOf("function buildCompactRoomSpeakerPrompt");
const compactEnd = main.indexOf("function shouldUseCompactRoomSpeakerPrompt", compactStart);
const compactBlock = compactStart >= 0 && compactEnd > compactStart ? main.slice(compactStart, compactEnd) : "";
const fullStart = main.indexOf("function buildRoomProviderPrompt");
const fullEnd = main.indexOf("function buildLocalRoomSpeakerPrompt", fullStart);
const fullBlock = fullStart >= 0 && fullEnd > fullStart ? main.slice(fullStart, fullEnd) : "";

mustInclude(main, "function buildCompactRoomSpeakerPrompt", "cloud speaker compact prompt helper exists");
mustInclude(main, "function shouldUseCompactRoomSpeakerPrompt", "compact speaker prompt gating helper exists");
mustInclude(main, 'const useLocalSpeakerPrompt = providerSelection.id === "local-chat-model"', "local speaker prompt path is explicit");
mustInclude(main, "shouldUseCompactRoomSpeakerPrompt(result, consoleState.room, userInput)", "cloud speaker can use compact prompt path");
mustInclude(main, "const roomPrompt = useCompactSpeakerPrompt", "speaker execution selects compact prompt before full prompt");
mustInclude(main, "? buildCompactRoomSpeakerPrompt(result, userInput, roomScope)", "compact prompt is selected before full prompt");
mustInclude(main, 'useLocalSpeakerPrompt ? "local_compact" : useCompactSpeakerPrompt ? "compact" : "full"', "diagnostics record local/compact/full prompt path without prompt text");
mustInclude(main, 'mode !== "casual"', "compact prompt is limited to casual room turns");
mustInclude(main, 'roomContextBudget(room) === "full"', "full budget disables compact prompt");
mustInclude(main, "result.privateDirective || result.factionHuddle || result.collaborationTask || result.simulationBeat", "complex role tasks disable compact prompt");
mustInclude(main, "result.plannerResult?.mode === \"cloud\"", "cloud planner turns disable compact prompt");
mustNotInclude(compactBlock, "buildLocalRoomSpeakerPrompt", "compact cloud prompt must not reuse the heavier local prompt shape");
mustNotInclude(compactBlock, "buildRoomProviderPrompt", "compact prompt must not call the full role prompt builder");
mustNotInclude(compactBlock, "buildCompactPlotArcLine", "compact cloud prompt must not inject plot/frame state");
mustNotInclude(compactBlock, "buildIdentityCardPromptBlock", "compact cloud prompt must not inject identity cards");
mustNotInclude(compactBlock, "buildRoleTaskCard", "compact cloud prompt must not inject the full task card");
mustNotInclude(compactBlock, "roomPrivateDirectiveInline", "compact cloud prompt must not carry private directive formatting");
mustNotInclude(compactBlock, "Director Script", "compact cloud prompt must not mention Director Script");
mustNotInclude(compactBlock, "Visible plot arc", "compact cloud prompt must not include full plot labels");
mustNotInclude(compactBlock, "Frame:", "compact cloud prompt must not include frame labels");
mustInclude(compactBlock, ".slice(-4)", "compact cloud prompt should keep recent context short");
mustInclude(compactBlock, ".slice(0, 2)", "compact cloud prompt should cap memory lines");
mustInclude(compactBlock, "casualTopicShift", "compact cloud prompt recognizes casual topic shift");
mustInclude(compactBlock, "The casual room needs a fresh topic", "casual topic shift uses compact fresh-topic instruction");
mustInclude(compactBlock, "Follow Room Rules and this role's style", "topic shift style is delegated to Room Rules and role style");
mustInclude(compactBlock, "natural jump if the rules allow it", "topic shift prompt allows distance to be constrained by prompt rules");
mustInclude(fullBlock, "compileLayeredPrompt", "full prompt remains available for complex turns");

console.log("Room compact speaker prompt validation passed.");
