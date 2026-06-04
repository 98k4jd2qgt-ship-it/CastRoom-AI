import fs from "node:fs";

const failures = [];
const adapter = fs.readFileSync("src/core/roomMemoryAdapter.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");

validateAdapterSurface();
validatePrivateMemoryRouting();
validateFactionMemoryRouting();
validatePublicMessageRouting();
validatePersistFailurePolicy();
validateMainIntegration();

if (failures.length > 0) {
  console.error(`RoomMemoryAdapter behavior validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("RoomMemoryAdapter behavior validation passed.");

function validateAdapterSurface() {
  mustInclude(adapter, "export class RoomMemoryAdapter", "RoomMemoryAdapter class");
  for (const method of [
    "recordRoomMessage",
    "recordSpeakerMessage",
    "recordDirectorPublicResult",
    "recordPrivateMessage",
    "recordFactionHuddle",
    "recordPassiveDirectorObservation",
  ]) {
    mustInclude(adapter, `${method}(`, `${method} method`);
  }
}

function validatePrivateMemoryRouting() {
  const block = sliceMethod(adapter, "recordPrivateMessage");
  mustInclude(block, ":observer:${roleId}", "private messages write observer-scoped memory");
  mustInclude(block, "recordDirectorHiddenRoomMemory", "private messages also write Director hidden memory");
  mustInclude(block, "visibility: \"private_participant\"", "private observer memory is private_participant");
  mustNotInclude(block, "kind: \"room_message\"", "private messages must not write public room memory");
}

function validateFactionMemoryRouting() {
  const block = sliceMethod(adapter, "recordFactionHuddle");
  mustInclude(block, ":faction:${thread.factionId}", "faction huddle writes faction-scoped memory");
  mustInclude(block, "kind: \"faction_huddle\"", "faction huddle uses faction_huddle event kind");
  mustNotInclude(block, "kind: \"room_message\"", "faction huddle must not write public room message memory");

  const messageBlock = sliceMethod(adapter, "recordFactionHuddleFromMessage");
  mustInclude(messageBlock, "return this.recordFactionHuddle(thread).results", "faction channel messages reuse faction huddle writer");
}

function validatePublicMessageRouting() {
  const roomBlock = sliceMethod(adapter, "recordRoomMessage");
  mustInclude(roomBlock, "kind: \"room_message\"", "public room messages write public room memory");
  mustInclude(roomBlock, "recordDirectorRoomObservationMemory", "public room messages can feed Director observation memory");
  mustInclude(roomBlock, "recordObservations", "public room messages can feed visible observer memory");

  const speakerBlock = sliceMethod(adapter, "recordSpeakerMessage");
  mustInclude(speakerBlock, "recordRoomMessage", "speaker public path reuses room message writer");
  mustInclude(speakerBlock, "kind: \"mention\"", "speaker path writes participant mention memory once");
}

function validatePersistFailurePolicy() {
  const recordBlock = sliceMethod(adapter, "private record");
  mustInclude(recordBlock, "try {", "persist path catches errors");
  mustInclude(recordBlock, "this.deps.persist()", "adapter persists saved records");
  mustInclude(recordBlock, "this.deps.diagnostics?.(\"warn\", \"RoomMemoryAdapter.persist\", error)", "persist failure goes to diagnostics");
  mustNotInclude(recordBlock, "throw error", "persist failure must not throw into Room hot path");
}

function validateMainIntegration() {
  mustInclude(main, "const roomMemoryAdapter = new RoomMemoryAdapter", "main creates RoomMemoryAdapter");
  mustInclude(main, "roomMemoryAdapter.recordRoomMessage", "room user message path delegates to adapter");
  mustInclude(main, "roomMemoryAdapter.recordSpeakerMessage", "room speaker path delegates to adapter");
  mustInclude(main, "roomMemoryAdapter.recordDirectorPublicResult", "Director public path delegates to adapter");
  mustInclude(main, "roomMemoryAdapter.recordFactionHuddle", "faction huddle path delegates to adapter");
  mustInclude(main, "roomMemoryAdapter.recordPassiveDirectorObservation", "passive Director memory delegates to adapter");
  mustNotInclude(main, "scope: `${roomScope}:observer:${roleId}`", "main must not construct observer memory scopes directly");
  mustNotInclude(main, "scope: `${roomScope}:faction:${thread.factionId}`", "main must not construct faction memory scopes directly");
}

function sliceMethod(source, name) {
  const marker = name === "private record" ? "  private record(" : `  ${name}(`;
  let start = source.indexOf(marker);
  if (start < 0 && name !== "private record") {
    start = source.indexOf(`  private ${name}(`);
  }
  if (start < 0) {
    failures.push(`missing method ${name}`);
    return "";
  }
  const bodyStart = source.indexOf("{", start);
  if (bodyStart < 0) {
    failures.push(`missing body for method ${name}`);
    return source.slice(start);
  }
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  failures.push(`unterminated body for method ${name}`);
  return source.slice(start);
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
