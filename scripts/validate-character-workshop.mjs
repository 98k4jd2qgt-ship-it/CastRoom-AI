import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const types = read("src/core/types.ts");
const appState = read("src/core/appState.ts");
const main = read("src/main.ts");
const ui = read("src/ui/petConsole.ts");
const commands = read("src/core/commands.ts");
const characterPacks = read("src/core/characterPacks.ts");
const persistence = read("src/core/persistence.ts");
const rust = read("src-tauri/src/lib.rs");
const tauriConfig = JSON.parse(read("src-tauri/tauri.conf.json"));

mustInclude(types, "CharacterWorkshopOperation", "Editable drafts must carry explicit create/edit/copy operation.");
mustInclude(types, "targetPackId", "Editable drafts must know the existing editable package target.");
mustInclude(types, "CharacterAssetDraftChange", "Asset edits must be represented as a change set.");
mustInclude(types, "SupportedCharacterTextAssetFormat", "Character packs must support text character visual assets.");
mustInclude(types, "kind: \"image\" | \"text\"", "Emotion assets must distinguish image and text candidates.");
mustInclude(types, "sourceDataUrl", "Packaged photo selection must carry image file data, not only a local path.");
mustInclude(types, "| { type: \"pack.saveDraftStart\" }", "Character Workshop save action must not require an apply flag.");
mustNotInclude(types, "pack.saveDraftStart\"; apply", "Save action must not expose Save & Apply.");

mustInclude(appState, "operation: \"create_new\"", "New character drafts must use create_new.");
mustInclude(appState, "operation: \"edit_existing\"", "Editing a built-in character must keep the same logical package id.");
mustInclude(appState, "targetPackId: packId", "Editing must target the selected package id instead of creating a visible copy.");
mustInclude(appState, "action.selectedPackId", "Save result must be able to select the saved package.");
mustInclude(appState, "sourceDataUrl: action.sourceDataUrl", "Asset drafts must preserve selected image data.");
mustInclude(characterPacks, "const importedIds = new Set(importedPackSummaries.keys())", "Editable overrides with the same id must hide the bundled summary.");
mustInclude(characterPacks, "filter((pack) => !importedIds.has(pack.id))", "Bundled packages must not appear beside same-id editable overrides.");
mustInclude(characterPacks, "convertFileSrc", "Project character pack images must be converted into Tauri asset URLs.");
mustInclude(characterPacks, "normalizeImportedAssetCandidate", "Imported asset candidates must be normalized before the UI renders them.");
mustInclude(characterPacks, "characterTextAssetModules", "Bundled character text assets must be indexed from idle/ and emotions/* folders.");
mustInclude(characterPacks, "sanitizeCharacterTextAsset", "Character text assets must strip ANSI/control characters before display.");
mustInclude(characterPacks, "compareEmotionAssetCandidates", "Character asset candidates must keep images before text fallbacks.");
mustInclude(characterPacks, "isLikelyLocalFilePath", "Only local filesystem paths should be converted to asset URLs.");
assertAssetProtocolScope();

mustNotInclude(main, "saveCharacterWorkshopDraft(action.apply)", "UI must not pass an apply flag to the save path.");
mustInclude(main, "draft.operation === \"edit_existing\"", "Saving an editable package must update the existing package.");
mustInclude(main, "draft.operation === \"edit_existing\"", "Saving an editable or built-in override package must update the selected package id.");
mustInclude(main, "action.type === \"prompt.openCharacterBase\"", "Editing a character prompt from Character Workshop must navigate to Prompt Center.");
mustInclude(main, "duplicate_character_pack", "Character duplication must use the backend package copier.");
mustInclude(main, "async function duplicateCharacterPack", "Character duplication must have an explicit async handler.");
mustInclude(main, "activeConsoleView = \"pack\"", "Character save/copy/delete flows must keep the user in Character Workshop.");
mustInclude(main, "loadPersistedActiveConsoleView() ?? \"config\"", "Startup must restore the last active console view so dev reloads after saving character packs do not jump to Config.");
mustInclude(main, "refreshCharacterPackRuntime(selectedPackId ?? undefined)", "Saving must refresh runtime character pack state.");
mustInclude(main, "requestRender(\"pack_save_result\"", "Saving must render the save result before the runtime refresh can leave the UI stuck on Saving.");
assertSaveResultRenderBeforeRuntimeRefresh();
mustInclude(main, "sourceDataUrl: change.sourceDataUrl", "Frontend save payload must include selected image data.");
mustInclude(main, "await invoke(\"delete_character_pack\", { packId })", "Deleting a character must remove the project character pack through the backend.");
mustInclude(main, "const characterMemoryScope = `character:${packId}` as MemoryScope", "Deleting a character must resolve the one-on-one character memory scope.");
mustInclude(main, "memoryStore.deleteScopeMemory(characterMemoryScope)", "Deleting a character must remove its one-on-one character memory from the runtime store.");
mustInclude(main, "persistMemoryStore({ graphScopes: [characterMemoryScope], graphReplace: true })", "Deleting a character must remove its graph memory from the runtime store.");
mustInclude(main, "one-on-one history and character memory were removed", "Deleting a character must tell the user private history and memory were removed.");
mustNotInclude(main, "shouldHideDeletedBundledFallback", "Deleting a character must not fall back to hiding a static bundled character.");
mustNotInclude(main, "pack.hideBuiltIn", "Deleting a character must not dispatch the old hidden-character action.");

const workshopStart = ui.indexOf("function renderCharacterWorkshopEditor");
const workshopEnd = ui.indexOf("function characterPromptTemplates");
const workshopUi = workshopStart >= 0 && workshopEnd > workshopStart ? ui.slice(workshopStart, workshopEnd) : "";
mustInclude(workshopUi, "draft.source === \"bundled\"", "Built-in edit notice must be based on source, not copy mode.");
mustNotInclude(workshopUi, "Save will create an editable copy", "Editing a built-in character must not be presented as a separate copy.");
mustInclude(workshopUi, "type: \"pack.saveDraftStart\"", "Workshop must have a single save action.");
mustNotInclude(workshopUi, "Save & Apply", "Character Workshop must not show Save & Apply.");
mustNotInclude(workshopUi, "apply: true", "Character Workshop must not trigger apply:true.");
mustNotInclude(workshopUi, "apply: false", "Character Workshop must not trigger apply:false.");
mustInclude(workshopUi, "commitDraftTextArea", "Character Workshop textarea edits must commit on blur/change, not on every keystroke.");
mustInclude(workshopUi, "commitOn: \"commit\"", "Character Workshop text inputs must avoid per-character dispatch that steals focus.");
mustNotInclude(workshopUi, "textarea.addEventListener(\"input\", () => setDraftField", "Character Workshop prompt textarea must not dispatch on every keystroke.");
mustInclude(ui, "readAsDataURL(file)", "Packaged builds must read selected images as file data.");
mustInclude(ui, "sourceDataUrl: file?.sourceDataUrl", "Image slot actions must pass selected image data.");
mustNotInclude(ui, "pack-import-box", "Character Workshop must hide the character-pack import panel.");
mustNotInclude(ui, "Import character pack", "Character Workshop must not show character-pack import copy.");
mustNotInclude(ui, "type: \"pack.validateStart\"", "Character Workshop must not expose import validation in the UI.");
mustNotInclude(ui, "type: \"pack.importStart\"", "Character Workshop must not expose character-pack import in the UI.");
mustNotInclude(ui, "pack.hideBuiltIn", "Character Workshop must not expose hidden-character behavior.");
mustNotInclude(ui, "pack.restoreHiddenBuiltIn", "Character Workshop must not expose hidden-character restore behavior.");
mustNotInclude(commands, "\"/pack import\"", "Character-pack import must not appear in debug-only slash commands.");
mustNotInclude(commands, "\"/pack validate\"", "Character-pack validation must not appear in debug-only slash commands.");
mustNotInclude(commands, "\"/pack inspect\"", "Character-pack inspection must not appear in debug-only slash commands.");

mustInclude(persistence, "APP_ACTIVE_VIEW_STORAGE_KEY", "The active Console view must be persisted separately from the large app state.");
mustInclude(persistence, "loadPersistedActiveConsoleView", "The active Console view must be restorable even if the full app-state save failed.");
mustInclude(persistence, "sanitizeCharacterDraftForPersistence", "Character Workshop image drafts must be sanitized before persistence.");
mustInclude(persistence, "sourceDataUrl: undefined", "Large selected image data must not be stored in localStorage.");

mustInclude(rust, "action: Option<String>", "Backend asset changes must support keep/replace/remove actions.");
mustInclude(rust, "source_data_url: Option<String>", "Backend asset changes must accept packaged image data.");
mustInclude(rust, "copy_dir_recursive(&source_dir, &target_dir)", "Saving a built-in package override must materialize the full package before editing.");
mustInclude(rust, "resolve_character_pack_source_dir", "Backend duplication must resolve imported and bundled package sources.");
mustInclude(rust, "copy_dir_recursive(&source_dir, &target_dir)", "Duplication must copy the whole package directory.");
mustInclude(rust, "asset.action.as_deref() == Some(\"remove\")", "Backend must support explicit image slot removal.");
mustInclude(rust, "write_character_asset_data_url", "Backend must write selected image data without relying on a local file path.");
mustInclude(rust, "decode_data_url", "Backend must decode Data URL image uploads.");
mustInclude(rust, "remove_character_asset_image_files", "Replacing a character image slot must remove old PNG/JPG/GIF images from that slot.");
mustInclude(rust, "MAX_CHARACTER_TEXT_ASSET_BYTES", "Text character assets must have a hard size limit.");
mustInclude(rust, "sanitize_character_text_asset", "Backend must sanitize text character assets.");
mustInclude(rust, "\"txt\" | \"art\" | \"ansi\"", "Backend must scan txt/art/ansi character visual assets.");
mustInclude(rust, "toml_section_values", "Character pack reader must parse manifest [emotions] mappings.");
mustInclude(rust, "emotion_entries_from_assets", "Character pack reader must infer emotions from idle/ and emotions/* folders.");
mustInclude(rust, "build_character_emotion_map", "Character pack read/write must merge manifest emotion mappings with asset folders.");
mustInclude(rust, "emotions.insert(\"idle\".to_string(), \"idle\".to_string())", "Character pack emotion mapping must always include idle.");
mustInclude(rust, "\"[emotions]\".to_string()", "Character pack writer must persist [emotions] mappings.");
mustNotInclude(rust, "remove_custom_asset_files", "Replacing a character image must not leave older non-custom images in the same slot.");
mustInclude(rust, "delete_character_private_data(&app, &source_id)", "Deleting a character must remove app-data direct room history and memory.");
mustInclude(rust, "remove_character_pack_dir(&source_dir)", "Deleting a character must remove the project character pack directly.");
mustNotInclude(rust, "Built-in characters can be hidden instead", "Backend delete errors must not tell users to hide characters.");
mustInclude(rust, "direct_room_history_dir(app, source_id, false)", "Deleting a character must remove its app-data one-on-one history directory.");
mustInclude(rust, "memory_scope_file_path(app, &memory_scope, false)", "Deleting a character must remove its app-data character memory file.");
mustInclude(rust, "clear_readonly_recursive", "Deleting a character must clear read-only flags before removing project pack files.");
mustNotInclude(rust, "Only imported or user-created characters can be duplicated by the backend.", "Bundled packages must be duplicable.");

if (failures.length > 0) {
  console.error(`Character Workshop validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Character Workshop validation passed");

function mustInclude(text, marker, message) {
  if (!text.includes(marker)) {
    failures.push(`${message} Missing marker: ${marker}`);
  }
}

function mustNotInclude(text, marker, message) {
  if (text.includes(marker)) {
    failures.push(`${message} Forbidden marker: ${marker}`);
  }
}

function assertAssetProtocolScope() {
  const assetProtocol = tauriConfig.app?.security?.assetProtocol;
  if (!assetProtocol?.enable) {
    failures.push("Tauri asset protocol must be enabled so project character pack images can render in packaged builds.");
  }
  const scope = Array.isArray(assetProtocol?.scope) ? assetProtocol.scope : assetProtocol?.scope?.allow;
  if (!Array.isArray(scope) || !scope.includes("../character-packs/**/*")) {
    failures.push("Tauri asset protocol scope must include ../character-packs/**/* for project character pack images.");
  }
  if (!Array.isArray(scope) || !scope.includes("$APPDATA/**/*")) {
    failures.push("Tauri asset protocol scope must keep $APPDATA/**/* for migrated character pack images.");
  }
}

function assertSaveResultRenderBeforeRuntimeRefresh() {
  const saveStart = main.indexOf("async function saveCharacterWorkshopDraft()");
  const saveEnd = main.indexOf("async function duplicateCharacterPack", saveStart);
  const saveBody = saveStart >= 0 && saveEnd > saveStart ? main.slice(saveStart, saveEnd) : "";
  const resultIndex = saveBody.indexOf("requestRender(\"pack_save_result\"");
  const refreshIndex = saveBody.indexOf("refreshCharacterPackRuntime(selectedPackId ?? undefined)");
  if (saveStart < 0 || saveEnd < 0 || resultIndex < 0 || refreshIndex < 0 || resultIndex > refreshIndex) {
    failures.push("Character save must render pack_save_result before refreshCharacterPackRuntime so the Save button leaves Saving immediately.");
  }
}
