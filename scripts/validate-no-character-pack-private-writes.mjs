import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const rust = fs.readFileSync("src-tauri/src/lib.rs", "utf8");

const failures = [];

const hotPath = main.slice(
  main.indexOf("function appendConsoleMessage("),
  main.indexOf("function findConsoleMessageStream", main.indexOf("function appendConsoleMessage(")),
);
if (hotPath.includes("save_character_chat_history") || hotPath.includes("save_character_pack_memory")) {
  failures.push("one-on-one hot path still writes private data into character packs");
}

const runtimeMemorySave = main.slice(
  main.indexOf("async function persistProjectRuntimeMemoryScopes"),
  main.indexOf("async function loadProjectRuntimeMemoryScopes"),
);
if (runtimeMemorySave.includes("save_character_pack_memory")) {
  failures.push("runtime memory save still writes to character pack memory");
}

const runtimeHistoryLoad = main.slice(
  main.indexOf("async function loadConsoleHistoryForPack"),
  main.indexOf("function canReplaceConsoleHistory"),
);
if (!runtimeHistoryLoad.includes("load_direct_room_history")) {
  failures.push("one-on-one history no longer loads from project runtime Direct Room");
}
if (!runtimeHistoryLoad.includes("loadLegacyCharacterPackHistoryForMigration")) {
  failures.push("legacy character-pack history migration is missing");
}

if (rust.includes("ensure_character_memory_files(")) {
  failures.push("character pack draft creation still creates memory files");
}
if (!rust.includes("remove_character_pack_private_dirs")) {
  failures.push("character pack import/duplicate does not strip private history/memory directories");
}
if (!rust.includes("load_memory_scope") || !rust.includes("save_memory_scope")) {
  failures.push("project runtime memory scope commands are missing");
}

if (failures.length > 0) {
  console.error(`No character-pack private writes validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("No character-pack private writes validation passed.");
