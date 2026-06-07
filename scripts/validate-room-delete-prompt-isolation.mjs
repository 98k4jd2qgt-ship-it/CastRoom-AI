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

const appState = read("src/core/appState.ts");
const main = read("src/main.ts");
const memory = read("src/core/memory.ts");

const createIndex = appState.indexOf("function createRoomInState");
const createBlock = createIndex >= 0 ? appState.slice(createIndex, createIndex + 900) : "";
if (!createBlock) {
  fail("createRoomInState must exist.");
}

requireIncludes("createRoomInState", createBlock, [
  "uniqueRoomIdForPromptIsolation(normalized.rooms, normalized.prompts, nextTitle)",
]);

if (createBlock.includes("uniqueRoomId(normalized.rooms, nextTitle)")) {
  fail("createRoomInState must not reuse the deterministic title-based room id.");
}

const deleteIndex = appState.indexOf("function deleteRoomInState");
const deleteBlock = deleteIndex >= 0 ? appState.slice(deleteIndex, deleteIndex + 1900) : "";
if (!deleteBlock) {
  fail("deleteRoomInState must exist.");
}

if (deleteBlock.includes('"room-empty"') || deleteBlock.includes("'room-empty'")) {
  fail("deleteRoomInState must not create the replacement room with the fixed id room-empty.");
}

requireIncludes("deleteRoomInState", deleteBlock, [
  "const promptsWithoutDeletedRoom = removePromptStateForRoom(normalized.prompts, roomId)",
  "uniqueRoomIdForPromptIsolation(normalized.rooms, promptsWithoutDeletedRoom, nextTitle)",
  "normalizePromptCenterStateAfterRoomChange",
  "prompts,",
]);

const removeIndex = appState.indexOf("function removePromptStateForRoom");
const removeBlock = removeIndex >= 0 ? appState.slice(removeIndex, removeIndex + 900) : "";
requireIncludes("removePromptStateForRoom", removeBlock, [
  "overrides: prompts.overrides.filter",
  "drafts: prompts.drafts.filter",
  "!isRoomScopedPromptTarget",
]);

const scopedIndex = appState.indexOf("function isRoomScopedPromptTarget");
const scopedBlock = scopedIndex >= 0 ? appState.slice(scopedIndex, scopedIndex + 900) : "";
requireIncludes("isRoomScopedPromptTarget", scopedBlock, [
  'scope === "room"',
  'scope === "director"',
  'scope === "room_role"',
  "targetId.startsWith(`${roomId}:`)",
]);

const uniqueIndex = appState.indexOf("function uniqueRoomIdForPromptIsolation");
const uniqueBlock = uniqueIndex >= 0 ? appState.slice(uniqueIndex, uniqueIndex + 1300) : "";
requireIncludes("uniqueRoomIdForPromptIsolation", uniqueBlock, [
  "roomIdsReferencedByPromptState(prompts)",
  "existing.add(id)",
  "Date.now().toString(36)",
  "return candidate",
]);

const promptEntryIndex = appState.indexOf("function roomIdFromPromptEntry");
const promptEntryBlock = promptEntryIndex >= 0 ? appState.slice(promptEntryIndex, promptEntryIndex + 800) : "";
requireIncludes("roomIdFromPromptEntry", promptEntryBlock, [
  'scope === "room" || scope === "director"',
  'scope === "room_role"',
  "targetId.indexOf",
]);

const deleteMemoryIndex = memory.indexOf("deleteRoomMemory(scope:");
const deleteMemoryBlock = deleteMemoryIndex >= 0 ? memory.slice(deleteMemoryIndex, deleteMemoryIndex + 550) : "";
requireIncludes("deleteRoomMemory", deleteMemoryBlock, [
  "MemoryScope[]",
  "return relatedScopes",
]);

const collectMemoryIndex = memory.indexOf("private collectRoomMemoryScopes");
const collectMemoryBlock = collectMemoryIndex >= 0 ? memory.slice(collectMemoryIndex, collectMemoryIndex + 1300) : "";
requireIncludes("collectRoomMemoryScopes", collectMemoryBlock, [
  "this.semanticObservations.values()",
  "this.graph.listAllClaimsSync()",
]);

const roomDeleteIndex = main.indexOf("const deletedRoomId = action.type === \"room.delete\"");
const roomDeleteBlock = roomDeleteIndex >= 0 ? main.slice(roomDeleteIndex, roomDeleteIndex + 900) : "";
requireIncludes("room delete persistence", roomDeleteBlock, [
  "const deletedStoreScopes = memoryStore.deleteRoomMemory",
  "graphScopes: Array.from(new Set([...deletedRoomMemoryScopes, ...deletedStoreScopes]))",
]);

if (failures.length > 0) {
  console.error("Room delete prompt isolation validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Room delete prompt isolation validation passed.");
