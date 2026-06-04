import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`${label} is missing: ${needle}`);
  }
}

const main = read("src/main.ts");
const persistence = read("src/core/persistence.ts");
const store = read("src/core/consoleMessageStore.ts");
const types = read("src/core/types.ts");
const rust = read("src-tauri/src/lib.rs");
const ui = read("src/ui/petConsole.ts");

assertIncludes(types, "export interface CharacterChatHistoryFile", "chat history type");
assertIncludes(types, "directRoomId?: `dm:${string}`", "direct room history id");
assertIncludes(types, "export interface PersistedChatImageAttachmentSummary", "image summary type");
assertIncludes(types, '"direct"', "direct room channel id");
assertIncludes(store, "replace(messages: ConsoleMessage[])", "message store replacement");
assertIncludes(store, "snapshotForHistory()", "history snapshot");
assertIncludes(main, "loadConsoleHistoryForPack", "history load helper");
assertIncludes(main, "rewriteDirectRoomHistoryForPack", "direct room rewrite helper");
assertIncludes(main, "appendDirectHistoryMessageForPack", "direct room append helper");
assertIncludes(main, "load_direct_room_history", "project runtime direct room load command use");
assertIncludes(main, "append_direct_room_message", "project runtime direct room append command use");
assertIncludes(main, "rewrite_direct_room_history", "project runtime direct room rewrite command use");
assertIncludes(main, "loadLegacyCharacterPackHistoryForMigration", "legacy history migration helper");
assertIncludes(main, "directRoomIdForPack", "direct room id helper");
assertIncludes(main, "normalizeDirectRoomMessage", "direct room message normalizer");
assertIncludes(main, "normalizeDirectRoomMessageInput", "direct room live input normalizer");
assertIncludes(main, 'channelId: "direct"', "direct room message channel");
assertIncludes(main, 'visibility: "public"', "direct room public visibility");
assertIncludes(main, "speakerType", "direct room speaker type");
assertIncludes(main, "speakerId", "direct room speaker id");
assertIncludes(main, "target", "direct room target");
assertIncludes(main, "sanitizeMessageForCharacterHistory", "history sanitizer");
assertIncludes(main, "appendDirectHistoryMessageForPack(activeCharacter.id, message)", "hot path appends one JSONL message");
assertIncludes(persistence, "consoleMessages?: ConsoleMessage[]", "legacy console history is optional");
assertIncludes(persistence, "parsed.consoleMessages", "legacy console history can still be migrated");
assertIncludes(rust, "project_runtime_data_dir", "project runtime data helper");
assertIncludes(rust, "load_direct_room_history", "project runtime load command");
assertIncludes(rust, "append_direct_room_message", "project runtime append command");
assertIncludes(rust, "rewrite_direct_room_history", "project runtime rewrite command");
assertIncludes(rust, "direct_room_history_file_path", "project runtime direct room file helper");
assertIncludes(rust, "messages.jsonl", "direct room JSONL storage");
assertIncludes(rust, "append_jsonl_message", "JSONL append helper");
assertIncludes(rust, "read_jsonl_messages", "JSONL read helper");
assertIncludes(rust, "remove_character_pack_private_dirs", "character pack private data stripping");
assertIncludes(ui, "message-attachment-placeholder", "persisted image placeholder");

if (/savePersistedAppState[\s\S]*consoleMessages:\s*input\.consoleMessages/.test(persistence)) {
  throw new Error("global consoleMessages are still persisted from input.consoleMessages");
}

const saveSignature = persistence.slice(
  persistence.indexOf("export function savePersistedAppState"),
  persistence.indexOf("const payload", persistence.indexOf("export function savePersistedAppState")),
);
if (saveSignature.includes("consoleMessages")) {
  throw new Error("savePersistedAppState still accepts runtime consoleMessages");
}

const appendFunction = main.slice(
  main.indexOf("function appendConsoleMessage("),
  main.indexOf("function findConsoleMessageStream", main.indexOf("function appendConsoleMessage(")),
);
if (appendFunction.includes("save_character_chat_history") || appendFunction.includes("rewrite_direct_room_history")) {
  throw new Error("appendConsoleMessage must append one message, not rewrite character history");
}

if (/attachments:\s*directMessage\.attachments\.map[\s\S]*dataUrl\s*:/.test(main)) {
  throw new Error("character chat history sanitizer must not persist attachment dataUrl");
}

console.log("Character chat history validation passed.");
