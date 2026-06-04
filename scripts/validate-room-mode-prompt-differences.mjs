import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(message) {
  failures.push(message);
}

function requireIncludes(label, text, patterns) {
  for (const pattern of patterns) {
    if (!text.includes(pattern)) {
      fail(`${label} is missing: ${pattern}`);
    }
  }
}

const prompts = read("src/core/prompts.ts");
const roomProfiles = read("src/core/roomProfiles.ts");

const modes = ["casual", "story", "mystery", "debate", "study", "planning", "team"];
for (const mode of modes) {
  requireIncludes("room mode prompt templates", prompts, [
    `mode: "${mode}"`,
    `commonDirectorFields("${mode}"`,
  ]);
}

requireIncludes("mode-specific director responsibilities", prompts, [
  "Casual mode responsibility",
  "Story mode responsibility",
  "Mystery mode responsibility",
  "Debate mode responsibility",
  "Study mode responsibility",
  "Planning mode responsibility",
  "Team Channel responsibility",
]);

const profileMarkers = [
  ["host", "Casual mode: keep the room readable with minimal intervention."],
  ["story-director", "Story mode: judge user actions as success, partial success, failure, blocked, or needs choice"],
  ["mystery-director", "Mystery mode: control clue visibility, hidden facts, theory handling, contradictions, and reveal timing."],
  ["study-moderator", "Study mode: decide whether the next move is explain, example, exercise, correction, recap, or wait."],
  ["debate-referee", "Debate mode: treat a request to judge after all speakers finish as a deferred requirement"],
  ["planning-facilitator", "Planning mode: converge when enough material exists and produce actionable next steps"],
];

for (const [profileId, marker] of profileMarkers) {
  requireIncludes(`director profile ${profileId}`, roomProfiles, [
    `directorPromptProfile("${profileId}"`,
    marker,
  ]);
}

const directorProfilesRegionStart = roomProfiles.indexOf("export const directorPromptProfiles");
const directorProfilesRegionEnd = roomProfiles.indexOf("export const roomRecipes", directorProfilesRegionStart);
if (directorProfilesRegionStart < 0 || directorProfilesRegionEnd < 0) {
  fail("Cannot locate directorPromptProfiles region.");
} else {
  const region = roomProfiles.slice(directorProfilesRegionStart, directorProfilesRegionEnd);
  if (!roomProfiles.includes("Mode focus:")) {
    fail("Director prompt profiles should append mode-specific focus text.");
  }
  if (region.includes("systemPrompt: neutralDirectorSystemPrompt")) {
    fail("Director prompt profiles should not all point directly at the same neutralDirectorSystemPrompt.");
  }
  if (region.includes("decisionRules: neutralDirectorDecisionRules")) {
    fail("Director prompt profiles should not all point directly at the same neutralDirectorDecisionRules.");
  }
}

const bannedConcretePrompts = [
  "恐龙的命是不是命",
  "Are dinosaurs' lives lives",
  "Are dinosaurs’ lives lives",
  "标准三人制辩论",
  "standard three-speaker debate",
  "standard three-person debate",
  "一辩二辩三辩",
  "all speakers finish, judge",
  "所有辩手发言结束后评判",
];
for (const pattern of bannedConcretePrompts) {
  if (prompts.includes(pattern) || roomProfiles.includes(pattern)) {
    fail(`Default prompt sources must not contain test prompt content: ${pattern}`);
  }
}

requireIncludes("room defaults", prompts, [
  "This room is for natural conversation.",
  "This room is for scene-based roleplay and narrative progression.",
  "This room is for clues, theories, hidden facts, contradiction handling, and controlled reveals.",
  "This room is for structured argument on a user-provided motion.",
  "This room is for explanation, practice, correction, and checking understanding.",
  "This room is for goals, constraints, risks, options, decisions, and next actions.",
  "This room is for faction coordination, private strategy, risk review, role assignment, and deciding what can be said publicly.",
]);

requireIncludes("director defaults", prompts, [
  "Keep the room readable with minimal intervention.",
  "Maintain scene continuity, action consequences, pressure, choices, and transitions.",
  "Control clue visibility, hidden facts, theory handling, contradictions, and reveal timing",
  "Control motion, sides, speaker positions, rounds, next speaker, phase summaries, and verdict timing",
  "Manage learning goal, current concept, explanation pace, practice, correction, and waiting for learner answers.",
  "Facilitate goal clarity, constraints, options, risks, decision points, and next actions",
  "Maintain faction visibility, collaboration opportunities, private boundaries, and public return plans",
]);

if (failures.length > 0) {
  console.error("Room mode prompt difference validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Room mode prompt difference validation passed.");
