import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(relativePath, patterns) {
  const text = read(relativePath);
  for (const pattern of patterns) {
    if (!text.includes(pattern)) {
      failures.push(`${relativePath} is missing required prompt marker: ${pattern}`);
    }
  }
}

function mustNotIncludeInTemplateRegion(relativePath, startMarker, endMarker, patterns) {
  const text = read(relativePath);
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    failures.push(`${relativePath} cannot locate template region ${startMarker}`);
    return;
  }
  const region = text.slice(start, end);
  for (const pattern of patterns) {
    if (region.includes(pattern)) {
      failures.push(`${relativePath} template region should not contain concrete default content: ${pattern}`);
    }
  }
}

function mustNotMatchInTemplateRegion(relativePath, startMarker, endMarker, regex, message) {
  const text = read(relativePath);
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    failures.push(`${relativePath} cannot locate template region ${startMarker}`);
    return;
  }
  const region = text.slice(start, end);
  if (regex.test(region)) {
    failures.push(`${relativePath} template region ${message}`);
  }
}

for (const file of ["src/core/characterPacks.ts", "src/core/ai.ts", "src/core/appState.ts", "src/ui/petConsole.ts"]) {
  mustInclude(file, [
    "Reply in the user's current primary language",
    "Do not repeat long user instructions",
    "Use only information visible",
    "Treat mood, energy, trust, and intensity as gradual state",
    "Motivation Mix",
    "staying silent, listening, or giving a short acknowledgement is valid",
  ]);
}

mustInclude("src/core/characterPacks.ts", ["This is only the long-term character layer"]);
mustInclude("src/core/ai.ts", ["This is only the long-term character layer"]);
mustInclude("src/core/appState.ts", ["This is only the long-term character layer"]);

mustInclude("src/core/prompts.ts", [
  "Layer: static Room Rules",
  "Runtime identity cards",
  "This is a multi-character Room, not a one-on-one chat box.",
  "Roles should not repeat long user instructions",
  "Roles may speak, stay silent, observe",
  "introduce a fresh topic when the room goes quiet or repetitive",
  "Follow the Room Rules for how far topic shifts may jump",
  "If selected to revive a quiet room",
  "Long-term facts require visible support, Director judgement, or explicit developer authority.",
  "This room is for natural conversation.",
  "This room is for scene-based roleplay and narrative progression.",
  "This room is for clues, theories, hidden facts, contradiction handling, and controlled reveals.",
  "This room is for structured argument on a user-provided motion.",
  "This room is for explanation, practice, correction, and checking understanding.",
  "This room is for goals, constraints, risks, options, decisions, and next actions.",
  "This room is for faction coordination, private strategy, risk review, role assignment, and deciding what can be said publicly.",
  "Layer: static Director Rules",
  "Mode policy, room state, collaboration plan, Director memory",
  "Mode Responsibility",
  "Debate mode responsibility",
  "Story mode responsibility",
  "background host, public narrator, pacing controller, fact ledger, visibility gatekeeper",
  "Control motion, sides, speaker positions, rounds, next speaker, phase summaries, and verdict timing",
  "Public speech is for immersive narration",
  "Public narration is scene-facing prose",
  "When asked to narrate publicly, output only the narration text",
  "Do not write labels, fields, Current scene, Goal, Open clues, Reason, Move, Next beat, Backstage, Focus",
  "Public narration may create an open-ended situation",
  "Role assignments, next speaker selection, target roles, faction strategy",
  "Room foundation",
  "Current pressure",
  "Motivation mix",
  "Dampers",
  "Visibility boundary",
  "User and role statements are claims by default",
  "Follow the current room mode policy injected at runtime",
  "Do not expose success, partial_success, Reason, Consequence, Director ruling",
  "Runtime private tasks, visible identity card fields, and visible memory",
  "Use only visible information",
  "export function compileLayeredPrompt",
  "export function buildRoomStateCapsule",
  "export function buildDirectorTaskCard",
  "export function buildRoleTaskCard",
  "export function buildPromptMemoryCapsule",
  "export function buildPromptGuardFeedback",
  "Layer order: system default template -> current mode policy -> runtime override -> state capsule -> memory capsule -> current turn task card -> guard feedback.",
]);

mustInclude("src/core/roomProfiles.ts", [
  "Static Room Rules layer",
  "Runtime identity, visible memory, collaboration state, and private directives",
  "Runtime speaker assignments, faction strategy, visible memory, and private directives",
  "multi-character Room, not a one-on-one chat box",
  "Roles may speak, stay silent, observe",
  "revive quiet/repetitive casual chat with one fresh topic within Room Rules",
  "Do not repeat long user instructions",
  "Do not force a plot, debate, lesson, or planning structure unless the user asks.",
  "Final judgement should wait until enough debate material exists or required speakers have finished.",
  "Static Director Rules layer",
  "background host, public narrator, pacing controller, fact ledger, visibility gatekeeper",
  "Public narration may create environment changes",
  "Public narration is scene-facing prose",
  "When asked to narrate publicly, output only the narration text",
  "Do not write Current scene, Goal, Open clues, Reason, Move, Next beat, Backstage, Focus",
  "Public speech is for immersive narration",
  "Use private directives for role assignments",
  "Mode-specific behavior belongs to DirectorModePolicy",
  "Do not expose success, partial_success, Reason, Consequence, Director ruling",
]);

mustInclude("src/main.ts", [
  "Prompt layer order for this turn: safety rules -> layered character prompt -> layered room prompt -> visible identity card -> private runtime directive -> visible memory and strategy -> recent visible context.",
  "Prompt layer order for this turn: safety rules -> layered Director prompt -> layered Room prompt -> collaboration plan -> Director graph memory -> visible private facts -> recent timeline.",
  "Visible memory is already included in the layered memory capsule. Do not duplicate the same fact in your reply.",
  "privateDirectives are private scheduling instructions for target roles. Never write privateDirectives as publicText or timeline dialogue.",
  "Stop reasons, technical judgement state, next-speaker scheduling, and private role tasks belong in Room Inspector or privateDirectives",
  "Team channel memory is private strategy for roles on the same team.",
]);

mustInclude("src/core/promptPresets.ts", [
  "isPromptPresetCompatibleWithTarget",
  "preset.kind !== expectedKind",
  "modes.includes(\"any\") || modes.includes(mode)",
]);

mustInclude("src/core/appState.ts", [
  "updatePromptOverride(state, target.scope, target.targetId, title, preset.text",
  "This preset cannot be applied to the current prompt target.",
]);

const bannedConcreteTemplateContent = [
  "Mio",
  "Rin",
  "Kai",
  "dragon",
  "vampire",
  "detective case",
  "murder",
  "treasure",
  "恐龙的命是不是命",
  "Are dinosaurs' lives lives",
  "Are dinosaurs’ lives lives",
  "标准三人制辩论",
  "standard three-speaker debate",
  "standard three-person debate",
  "一辩二辩三辩",
  "所有辩手发言结束后评判",
];

mustNotIncludeInTemplateRegion(
  "src/core/prompts.ts",
  "const roomModePromptTemplates",
  "function field",
  bannedConcreteTemplateContent,
);

mustNotIncludeInTemplateRegion(
  "src/core/roomProfiles.ts",
  "export const roomPromptProfiles",
  "export const roomDirectorProfiles",
  bannedConcreteTemplateContent,
);

mustNotIncludeInTemplateRegion(
  "src/core/prompts.ts",
  "const roomModePromptTemplates",
  "function field",
  [
    "Wait for user direction when there is no visible next step.",
    "Pause on repetition, unavailable model, direct player choice, unclear direction, or lack of a visible next step.",
  ],
);

mustNotMatchInTemplateRegion(
  "src/core/prompts.ts",
  "const roomModePromptTemplates",
  "function field",
  /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u,
  "must keep built-in Room and Director template text English-only.",
);

mustNotMatchInTemplateRegion(
  "src/core/roomProfiles.ts",
  "export const roomPromptProfiles",
  "export const roomRecipes",
  /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u,
  "must keep built-in Room and Director profile text English-only.",
);

if (failures.length > 0) {
  console.error("Neutral prompt template validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Neutral prompt template validation passed.");
