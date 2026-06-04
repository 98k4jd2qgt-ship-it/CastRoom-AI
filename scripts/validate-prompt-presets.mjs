import fs from "node:fs";

const failures = [];

const types = read("src/core/types.ts");
const presets = read("src/core/promptPresets.ts");
const appState = read("src/core/appState.ts");
const persistence = read("src/core/persistence.ts");
const main = read("src/main.ts");
const promptUi = read("src/ui/petConsole.ts");
const styles = read("src/styles.css");
const tauri = read("src-tauri/src/lib.rs");
const packageJson = read("package.json");
const prompts = read("src/core/prompts.ts");

validateTypes();
validatePresetModule();
validateReducerAndPersistence();
validateUi();
validateTauriStorage();
validateRuntimeIsolation();
validatePackageScript();

if (failures.length > 0) {
  console.error(`Prompt preset validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Prompt preset validation passed.");

function validateTypes() {
  mustInclude(types, "export type PromptPresetKind", "PromptPresetKind type");
  mustInclude(types, "export interface PromptPreset", "PromptPreset interface");
  mustInclude(types, "presets: PromptPreset[]", "PromptCenterState preset list");
  for (const kind of ["character_base", "room_rules", "director_rules", "room_role_override"]) {
    mustInclude(types, `"${kind}"`, `preset kind ${kind}`);
  }
  for (const action of [
    "promptPreset.create",
    "promptPreset.update",
    "promptPreset.delete",
    "promptPreset.applyToCurrentTarget",
    "promptPreset.importPack",
  ]) {
    mustInclude(types, action, `ConsoleAction ${action}`);
  }
}

function validatePresetModule() {
  for (const marker of [
    "promptPresetKindForTarget",
    "isPromptPresetCompatibleWithTarget",
    "listPromptPresetsForTarget",
    "createPromptPreset",
    "normalizePromptPresets",
    "importPromptPresets",
    "maxPromptPresetTextChars",
  ]) {
    mustInclude(presets, marker, `prompt preset helper ${marker}`);
  }
  mustInclude(presets, "scope === \"character_pack\"", "character presets target only character packs");
  mustInclude(presets, "scope === \"director\"", "director presets target only Director Rules");
  mustInclude(presets, "scope === \"room_role\"", "room role override presets target only room roles");
  mustInclude(presets, "preset.kind !== expectedKind", "kind mismatch rejects incompatible presets");
  mustInclude(presets, "modes.includes(\"any\") || modes.includes(mode)", "mode-aware room/director presets");
}

function validateReducerAndPersistence() {
  mustInclude(appState, "case \"promptPreset.create\"", "create reducer");
  mustInclude(appState, "case \"promptPreset.applyToCurrentTarget\"", "apply reducer");
  mustInclude(appState, "This preset cannot be applied to the current prompt target.", "incompatible target error");
  mustInclude(appState, "updatePromptOverride(state, target.scope, target.targetId, title, preset.text", "apply copies preset text into override");
  mustNotInclude(appState, "preset.text =", "reducer must not mutate preset text directly");
  mustInclude(persistence, "presets: normalizePromptPresets", "persisted app state restores preset list safely");
  mustInclude(main, "restorePromptPresetLibrary", "main restores app-data prompt preset library");
  mustInclude(main, "persistPromptPresetLibrary", "main persists app-data prompt preset library");
  mustInclude(main, "save_prompt_presets", "main saves prompt preset library through Tauri");
}

function validateUi() {
  mustInclude(promptUi, "renderPromptPresetSelector", "Prompt Center preset selector UI");
  mustInclude(promptUi, "openPromptPresetPopover", "Prompt Center preset floating menu");
  mustInclude(promptUi, "prompt-preset-search", "Prompt preset menu search input");
  mustInclude(promptUi, "prompt-preset-popover-preview", "Prompt preset preview lives in popover");
  mustInclude(promptUi, "syncPreview", "Prompt preset popover preview updates on selection");
  mustInclude(promptUi, "prompt-preset-save-form", "Prompt preset explicit save form");
  mustInclude(promptUi, "selectAfterCreate: true", "newly saved preset becomes selected");
  mustInclude(promptUi, "promptPreset.select", "Prompt Center can select presets before applying");
  mustInclude(promptUi, "promptPreset.create", "Prompt Center can create presets");
  mustInclude(promptUi, "promptPreset.applyToCurrentTarget", "Prompt Center can apply presets");
  mustInclude(promptUi, "promptPreset.delete", "Prompt Center can delete presets");
  mustInclude(promptUi, "listPromptPresetsForTarget", "Prompt Center filters compatible presets");
  mustInclude(promptUi, "Apply copies it into the current target.", "UI explains explicit snapshot apply behavior");
  mustNotInclude(promptUi, "className = \"prompt-preset-preview\"", "main page must not render a permanent preset preview");
  mustInclude(styles, ".prompt-preset-toolbar", "compact preset toolbar styles");
  mustInclude(styles, ".prompt-preset-popover-preview", "popover preset preview styles");
  mustNotInclude(styles, ".prompt-preset-preview pre", "main page must not reserve preset preview text height");
}

function validateTauriStorage() {
  mustInclude(tauri, "load_prompt_presets", "Tauri load_prompt_presets command");
  mustInclude(tauri, "save_prompt_presets", "Tauri save_prompt_presets command");
  mustInclude(tauri, "import_prompt_pack_from_path", "Tauri prompt pack import command");
  mustInclude(tauri, "prompt-presets", "prompt presets app-data directory");
  mustInclude(tauri, "prompt-pack.json", "prompt pack manifest support");
  mustInclude(tauri, "forbidden private data key", "prompt pack rejects private data keys");
  for (const forbidden of ["api_key", "history", "memory", "diagnostics", "logs"]) {
    mustInclude(tauri, forbidden, `prompt pack forbidden key ${forbidden}`);
  }
}

function validateRuntimeIsolation() {
  mustNotInclude(prompts, "PromptPreset", "prompt presets must not participate directly in prompt compilation");
  mustNotInclude(prompts, "presets", "prompt compiler should not read preset library");
  mustInclude(appState, "lastMessage: `${preset.title} copied to ${title}.`", "apply preset reports copied snapshot");
  mustInclude(appState, "presets: state.prompts.presets.filter", "delete preset leaves prompt overrides untouched");
}

function validatePackageScript() {
  mustInclude(packageJson, "node scripts/validate-prompt-presets.mjs", "npm check includes prompt preset validation");
}

function read(relativePath) {
  return fs.readFileSync(relativePath, "utf8");
}

function mustInclude(source, marker, label) {
  if (!source.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}

function mustNotInclude(source, marker, label) {
  if (source.includes(marker)) {
    failures.push(`${label}: ${marker}`);
  }
}
