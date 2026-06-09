import fs from "node:fs";

const failures = [];

const mainSource = fs.readFileSync("src/main.ts", "utf8");
const tauriSource = fs.readFileSync("src-tauri/src/lib.rs", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

validateTauriCommands();
validateFrontendCascade();
validateStartupPrune();
validateCheckScript();

if (failures.length > 0) {
  console.error(`Room delete memory persistence validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room delete memory persistence validation passed.");

function validateTauriCommands() {
  expect(tauriSource.includes("fn delete_memory_scope("), "Tauri should expose delete_memory_scope.");
  expect(tauriSource.includes("fn delete_room_memory_files("), "Tauri should expose delete_room_memory_files.");
  expect(tauriSource.includes("fn prune_orphan_room_memory("), "Tauri should expose prune_orphan_room_memory.");
  expect(tauriSource.includes("delete_project_room_memory_files(&app, &room_id)?"), "delete_room_memory_files should delete project runtime room memory.");
  expect(tauriSource.includes("delete_character_pack_room_memory_files(&app, &room_id)?"), "delete_room_memory_files should delete legacy character-pack room memory.");
  expect(tauriSource.includes("prune_project_room_memory_files(&app, &live_room_ids)?"), "orphan prune should clean project runtime room dirs.");
  expect(tauriSource.includes("prune_character_pack_room_memory_files(&app, &live_room_ids)?"), "orphan prune should clean legacy room dirs.");
  expect(tauriSource.includes("delete_memory_scope,"), "delete_memory_scope should be registered in the invoke handler.");
  expect(tauriSource.includes("delete_room_memory_files,"), "delete_room_memory_files should be registered in the invoke handler.");
  expect(tauriSource.includes("prune_orphan_room_memory,"), "prune_orphan_room_memory should be registered in the invoke handler.");
}

function validateFrontendCascade() {
  expect(mainSource.includes("const deletedRoomMemoryIds = new Set<string>()"), "frontend should track room ids deleted in this session.");
  expect(mainSource.includes("function roomIdFromMemoryScope("), "frontend should parse room ids from memory scopes.");
  expect(mainSource.includes("function isDeletedOrOrphanRoomMemoryScope("), "frontend should identify deleted/orphan room scopes.");
  expect(mainSource.includes("function clearSemanticDirtyScopes("), "deleting a room should clear pending semantic dirty scopes.");
  expect(mainSource.includes("function deletePersistentRoomMemory("), "frontend should delete persistent room memory files.");
  expect(mainSource.includes('invoke("delete_memory_scope", { scope })'), "persistent deletion should remove individual scope files.");
  expect(mainSource.includes('invoke("delete_room_memory_files", { roomId })'), "persistent deletion should remove room memory directories.");
  expect(mainSource.includes("deletedRoomMemoryIds.add(deletedRoomId)"), "room.delete should mark the room id as deleted before persistence.");
  expect(mainSource.includes("clearSemanticDirtyScopes(deletedScopes)"), "room.delete should clear delayed semantic extraction scopes.");
  expect(mainSource.includes("void deletePersistentRoomMemory(deletedRoomId, deletedScopes)"), "room.delete should invoke persistent room memory deletion.");
  expect(mainSource.includes("projectRuntimeMemoryScopeRecords"), "project runtime scope collection should exist.");
  expect(mainSource.includes(".filter((scope) => !isDeletedOrOrphanRoomMemoryScope(scope, liveRoomIds))"), "project runtime saves should skip deleted or orphan room scopes.");
}

function validateStartupPrune() {
  expect(mainSource.includes("function pruneOrphanRoomMemoryFromRuntimeStore("), "startup should prune orphan room scopes from the runtime store.");
  expect(mainSource.includes("function prunePersistentOrphanRoomMemory("), "startup should prune orphan room files from disk.");
  expect(mainSource.includes("const prunedScopes = pruneOrphanRoomMemoryFromRuntimeStore(liveRoomIds)"), "loadProjectRuntimeMemoryScopes should prune runtime orphan scopes before loading files.");
  expect(mainSource.includes("void prunePersistentOrphanRoomMemory(liveRoomIds)"), "loadProjectRuntimeMemoryScopes should request disk orphan pruning.");
  expect(mainSource.includes("!isLiveRoomMemoryScope(scope, liveRoomIds)"), "loadProjectRuntimeMemoryScopes should skip orphan file-backed scopes.");
  expect(mainSource.includes("isLiveLegacyRoomScope"), "legacy room role memory migration should be live-room gated.");
  expect(mainSource.includes("/^room:[^:]+:role:[^:]+$/.test(file.scope) && isLiveRoomMemoryScope(file.scope, liveRoomIds)"), "legacy room role memory should not migrate deleted rooms.");
}

function validateCheckScript() {
  expect(
    packageJson.scripts.check.includes("node scripts/validate-room-delete-memory-persistence.mjs"),
    "npm run check should include validate-room-delete-memory-persistence.mjs.",
  );
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
