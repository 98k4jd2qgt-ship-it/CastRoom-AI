import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const modulePaths = [
  "src/core/roomProfiles.ts",
  "src/core/roomVisibility.ts",
  "src/core/directorModePolicy.ts",
  "src/core/debatePolicy.ts",
  "src/core/roomCollaborationPolicy.ts",
  "src/core/roomRuleGuards.ts",
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustExist(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push(`${relativePath} is missing`);
  }
}

function mustInclude(relativePath, markers) {
  const text = read(relativePath);
  for (const marker of markers) {
    if (!text.includes(marker)) {
      failures.push(`${relativePath} is missing ${marker}`);
    }
  }
}

function mustNotInclude(relativePath, markers) {
  const text = read(relativePath);
  for (const marker of markers) {
    if (text.includes(marker)) {
      failures.push(`${relativePath} still contains ${marker}`);
    }
  }
}

for (const relativePath of modulePaths) {
  mustExist(relativePath);
}

mustInclude("src/core/roomScheduler.ts", [
  'from "./roomProfiles"',
  'from "./roomVisibility"',
  'from "./directorModePolicy"',
  'from "./debatePolicy"',
  'from "./roomCollaborationPolicy"',
  'from "./roomRuleGuards"',
  "scheduleRoomTurn",
  "scheduleRoomDirectorTurn",
]);

mustInclude("src/core/roomProfiles.ts", [
  "export const roomPromptProfiles",
  "export const roomDirectorProfiles",
  "export const directorPromptProfiles",
  "export const roomRecipes",
  "export function getRoomPromptProfile",
]);

mustInclude("src/core/roomVisibility.ts", [
  "export function parseRoomMentions",
  "export function resolveRoomMessageVisibility",
  "export function deriveRoomChannels",
  "export function getVisibleContextForParticipant",
]);

mustInclude("src/core/directorModePolicy.ts", [
  "export interface DirectorModePolicy",
  "export const DIRECTOR_MODE_POLICIES",
  "export function resolveDirectorModeIntent",
  "export function buildModeRoleTask",
]);

mustInclude("src/core/debatePolicy.ts", [
  "export function createDebateDirectorSetupText",
  "export function createDebateTurnGoal",
  "export function formatDebateAssignments",
  "export function resolveNextDebateSpeakerAssignment",
]);

mustInclude("src/core/roomCollaborationPolicy.ts", [
  "export function resolveCollaborationNeed",
  "export function buildCollaborationPlanFromHuddle",
  "export function createFactionHuddleThread",
  "export function chooseCollaborationDirectiveParticipant",
]);

mustInclude("src/core/roomRuleGuards.ts", [
  "export function evaluateAiDraftAgainstDirectorRules",
  "export function validateDraftWithDirectorRules",
  "export function parseDirectorOverrideRequest",
  "export function applyDirectorOverride",
]);

mustNotInclude("src/core/roomScheduler.ts", [
  "export const roomPromptProfiles:",
  "export const roomDirectorProfiles:",
  "export const directorPromptProfiles:",
  "export const roomRecipes:",
  "function resolveRoomMessageVisibility(",
  "function deriveRoomChannels(",
  "function createDebateDirectorSetupText(",
  "function createFactionStrategyObjective(",
  "const ROOM_FACT_REWRITE_PATTERN",
  "const DIRECTOR_MODE_POLICIES",
]);

for (const relativePath of modulePaths) {
  mustNotInclude(relativePath, [
    'from "../main"',
    'from "./main"',
    "render()",
    "render(",
    "requestChatCompletion",
    "recordAppMemoryEvent",
    "persistMemoryStore",
  ]);
}

if (failures.length > 0) {
  console.error("Room scheduler module validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Room scheduler module validation passed.");
