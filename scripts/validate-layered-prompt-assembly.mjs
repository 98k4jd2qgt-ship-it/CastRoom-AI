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

const types = read("src/core/types.ts");
const prompts = read("src/core/prompts.ts");
const main = read("src/main.ts");

requireIncludes("Prompt assembly types", types, [
  "export type PromptAssemblyTarget",
  "export interface PromptStateCapsule",
  "export interface PromptMemoryCapsule",
  "export interface PromptTaskCard",
  "export interface PromptGuardFeedback",
  "export interface PromptAssemblyContext",
  "defaultTemplate: string",
  "overrideText?: string",
  "stateCapsule?: PromptStateCapsule",
  "memoryCapsule?: PromptMemoryCapsule",
  "taskCard?: PromptTaskCard",
  "guardFeedback?: PromptGuardFeedback",
]);

requireIncludes("Prompt assembly helpers", prompts, [
  "export function compileLayeredPrompt",
  "export function buildRoomStateCapsule",
  "export function buildDirectorTaskCard",
  "export function buildRoleTaskCard",
  "export function buildPromptMemoryCapsule",
  "export function buildPromptGuardFeedback",
  "# CastRoom AI Layered Prompt",
  "Layer order: system default template -> current mode policy -> runtime override -> state capsule -> memory capsule -> current turn task card -> guard feedback.",
  'appendPromptLayer(parts, "System Default Template", context.defaultTemplate)',
  'appendPromptLayer(parts, "Runtime Override", context.overrideText)',
]);

requireIncludes("Room runtime prompt assembly", main, [
  "compileLayeredPrompt({",
  'target: "director"',
  'target: "room"',
  'target: "role"',
  "defaultPromptText(\"director\"",
  "defaultPromptText(\"room\"",
  "buildRoomStateCapsule(consoleState.room",
  "buildPromptMemoryCapsule(",
  "buildDirectorTaskCard(",
  "buildRoleTaskCard(",
  "buildPromptGuardFeedback(consoleState.room)",
  "Visible memory is already included in the layered memory capsule. Do not duplicate the same fact in your reply.",
]);

const compileUseCount = (main.match(/compileLayeredPrompt\(\{/g) ?? []).length;
if (compileUseCount < 3) {
  fail(`Room runtime should assemble layered prompts for Director, Room, and Role targets; found ${compileUseCount}.`);
}

const directorAssemblyIndex = main.indexOf('target: "director"');
const roleAssemblyIndex = main.indexOf('target: "role"');
if (directorAssemblyIndex < 0 || roleAssemblyIndex < 0 || directorAssemblyIndex > roleAssemblyIndex) {
  fail("Director layered prompt should be assembled before role prompt hot path usage.");
}

if (failures.length > 0) {
  console.error("Layered prompt assembly validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Layered prompt assembly validation passed.");
