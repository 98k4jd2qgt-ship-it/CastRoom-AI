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
  "return candidate",
]);

const promptEntryIndex = appState.indexOf("function roomIdFromPromptEntry");
const promptEntryBlock = promptEntryIndex >= 0 ? appState.slice(promptEntryIndex, promptEntryIndex + 800) : "";
requireIncludes("roomIdFromPromptEntry", promptEntryBlock, [
  'scope === "room" || scope === "director"',
  'scope === "room_role"',
  "targetId.indexOf",
]);

if (failures.length > 0) {
  console.error("Room delete prompt isolation validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Room delete prompt isolation validation passed.");
