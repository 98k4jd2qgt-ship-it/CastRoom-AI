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

const petConsole = read("src/ui/petConsole.ts");
const appState = read("src/core/appState.ts");
const prompts = read("src/core/prompts.ts");

requireIncludes("Prompt Center restore action", petConsole, [
  'type: "prompt.restoreTemplate"',
  "defaultText: defaultPromptText(target.scope, target.targetId, props.state)",
]);

const restoreActionIndex = petConsole.indexOf('type: "prompt.restoreTemplate"');
const restoreActionBlock = restoreActionIndex >= 0 ? petConsole.slice(restoreActionIndex, restoreActionIndex + 420) : "";
if (restoreActionBlock.includes("textarea.value") || restoreActionBlock.includes("currentText") || restoreActionBlock.includes("preview.text")) {
  fail("Restore Template action must pass defaultPromptText, not current editor text, preview text, or draft text.");
}

requireIncludes("prompt.restoreTemplate reducer", appState, [
  'case "prompt.restoreTemplate"',
  "text: action.defaultText",
  "enabled: false",
  "activeText: undefined",
]);

const reducerIndex = appState.indexOf('case "prompt.restoreTemplate"');
const reducerBlock = reducerIndex >= 0 ? appState.slice(reducerIndex, reducerIndex + 1400) : "";
if (!reducerBlock.includes("text: action.defaultText")) {
  fail("prompt.restoreTemplate reducer must write action.defaultText into the editor draft.");
}
if (reducerBlock.includes("findPromptOverride") || reducerBlock.includes("preset.text")) {
  fail("prompt.restoreTemplate reducer must not recover template text from overrides or presets.");
}

requireIncludes("defaultPromptText", prompts, [
  "export function defaultPromptText",
  "compileRoomRulesPrompt",
  "compileDirectorRulesPrompt",
  "getRoomModeTemplate(mode)",
]);

const defaultPromptIndex = prompts.indexOf("export function defaultPromptText");
const defaultPromptBlock = defaultPromptIndex >= 0 ? prompts.slice(defaultPromptIndex, defaultPromptIndex + 1800) : "";
if (defaultPromptBlock.includes("findPromptDraft") || defaultPromptBlock.includes("findPromptOverride") || defaultPromptBlock.includes("findLegacyRoomPromptFallback")) {
  fail("defaultPromptText must be a system-template source and must not read draft, override, or legacy prompt text.");
}

if (failures.length > 0) {
  console.error("Prompt restore source validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Prompt restore source validation passed.");
