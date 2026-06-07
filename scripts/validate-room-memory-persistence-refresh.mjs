import fs from "node:fs";

const failures = [];

const mainSource = fs.readFileSync("src/main.ts", "utf8");
const adapterSource = fs.readFileSync("src/core/roomMemoryAdapter.ts", "utf8");
const memorySource = fs.readFileSync("src/core/memory.ts", "utf8");

validateAdapterWrittenScopes();
validateMainPersistenceRefresh();
validateMemorySerialization();

if (failures.length > 0) {
  console.error(`Room memory persistence refresh validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room memory persistence refresh validation passed.");

function validateAdapterWrittenScopes() {
  expect(adapterSource.includes("writtenScopes: MemoryScope[]"), "RoomMemoryAdapterResult should expose writtenScopes");
  expect(adapterSource.includes("speakerId: message.speakerId"), "room messages should persist speakerId for role attribution");
  expect(adapterSource.includes("speakerType: message.speakerType"), "room messages should persist speakerType for semantic attribution");
  expect(adapterSource.includes("uniqueScopes("), "adapter should dedupe written scopes");
  expect(adapterSource.includes("writtenScopes: []"), "empty adapter result should carry empty writtenScopes");
}

function validateMainPersistenceRefresh() {
  expect(mainSource.includes("recordRoomMemoryAdapterResult("), "main should use a unified room memory result handler");
  expect(mainSource.includes("persistWrittenMemoryScopes("), "written scopes should be persisted after adapter writes");
  expect(mainSource.includes("markSemanticMemoryDirty("), "adapter writes should mark semantic memory dirty");
  expect(mainSource.includes("flushSemanticMemoryDirtyScopes(\"memory_view\")"), "memory view render should flush pending semantic memory");
  expect(mainSource.includes("notifyMemoryDashboardUpdated()"), "memory dashboard should refresh after memory writes");
}

function validateMemorySerialization() {
  expect(memorySource.includes("semanticObservations?: SemanticMemoryObservation[]"), "MemoryStoreData should serialize semantic observations");
  expect(memorySource.includes("private readonly semanticObservations"), "MemoryStore should store semantic observations");
  expect(memorySource.includes("listSemanticObservations("), "MemoryStore should list semantic observations");
  expect(memorySource.includes("processSemanticObservationsForScopes("), "MemoryStore should expose batch semantic extraction");
  expect(memorySource.includes("semanticObservations: [...this.semanticObservations.values()]"), "full serialization should include semantic observations");
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
