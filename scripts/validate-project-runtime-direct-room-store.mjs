import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustInclude(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`${label} is missing: ${needle}`);
  }
}

const main = read("src/main.ts");
const rust = read("src-tauri/src/lib.rs");

mustInclude(rust, "project_runtime_data_dir", "project runtime data directory helper");
mustInclude(rust, "project_dir.join(\"runtime-data\")", "project runtime data lives beside project files");
mustInclude(rust, "direct_room_history_dir", "direct room project data directory helper");
mustInclude(rust, "project_runtime_data_dir(app)?.join(\"direct-rooms\")", "direct rooms live under project runtime-data");
mustInclude(rust, "messages.jsonl", "direct room JSONL filename");
mustInclude(rust, "OpenOptions::new()", "append-only JSONL writer");
mustInclude(rust, "append_direct_room_message", "append command");
mustInclude(rust, "rewrite_direct_room_history", "rewrite command for migration only");
mustInclude(rust, "load_direct_room_history", "load command");

mustInclude(main, "PROJECT_RUNTIME_DIRECT_ROOM_HISTORY_ENABLED", "project runtime direct room feature flag");
mustInclude(main, "appendDirectHistoryMessageForPack", "front-end append helper");
mustInclude(main, "append_direct_room_message", "front-end append command");
mustInclude(main, "rewriteDirectRoomHistoryForPack", "front-end rewrite helper");
mustInclude(main, "loadLegacyCharacterPackHistoryForMigration", "legacy character pack migration helper");

const appendFunction = main.slice(
  main.indexOf("function appendConsoleMessage("),
  main.indexOf("function findConsoleMessageStream", main.indexOf("function appendConsoleMessage(")),
);
if (!appendFunction.includes("appendDirectHistoryMessageForPack(activeCharacter.id, message)")) {
  throw new Error("appendConsoleMessage does not append to project-runtime Direct Room storage");
}
if (appendFunction.includes("queueConsoleHistorySaveForPack") || appendFunction.includes("rewriteDirectRoomHistoryForPack")) {
  throw new Error("appendConsoleMessage still rewrites full history on the hot path");
}

console.log("Project runtime direct room store validation passed.");
