import fs from "node:fs";

const checks = [
  {
    file: "src/core/types.ts",
    patterns: [
      "RoomRoleMemoryScope",
      "CharacterPackMemoryFile",
      "MemoryEditPatch",
      "memoryScope: RoomRoleMemoryScope",
    ],
  },
  {
    file: "src/core/memory.ts",
    patterns: [
      "editCompressedMemory",
      "createCompressedMemory",
      "editShortTermMention",
      "promoteShortTermMention",
      "serializeScope",
      "restoreScope",
      "isPlainRoomMemoryScope",
    ],
  },
  {
    file: "src/main.ts",
    patterns: [
      "persistProjectRuntimeMemoryScopes",
      "loadProjectRuntimeMemoryScopes",
      "projectRuntimeMemoryScopeRecords",
      "save_memory_scope",
      "load_memory_scope",
      "participant.memoryScope",
      "Memory.projectData.save",
      "Memory.projectData.load",
    ],
  },
  {
    file: "src-tauri/src/lib.rs",
    patterns: [
      "load_memory_scope",
      "save_memory_scope",
      "project_runtime_data_dir",
      "memory_scope_file_path",
      "join(\"characters\")",
      "director.json",
      "roles",
    ],
  },
  {
    file: "src/ui/petConsole.ts",
    patterns: [
      "editMemory",
      "editShortTerm",
      "promoteShortTerm",
    ],
  },
];

const failures = [];

for (const check of checks) {
  const text = fs.readFileSync(check.file, "utf8");
  for (const pattern of check.patterns) {
    if (!text.includes(pattern)) {
      failures.push(`${check.file} is missing "${pattern}"`);
    }
  }
}

const main = fs.readFileSync("src/main.ts", "utf8");
const rust = fs.readFileSync("src-tauri/src/lib.rs", "utf8");

const runtimeSaveFunction = main.slice(
  main.indexOf("async function persistProjectRuntimeMemoryScopes"),
  main.indexOf("async function loadProjectRuntimeMemoryScopes"),
);
if (runtimeSaveFunction.includes("save_character_pack_memory")) {
  failures.push("runtime memory persistence still writes to character pack memory");
}

if (rust.includes("ensure_character_memory_files(")) {
  failures.push("character pack creation still creates private memory files");
}

if (failures.length > 0) {
  console.error(`Character memory file validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Character memory file validation passed");
