import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const failures = [];

const adapterSource = fs.readFileSync("src/core/roomMemoryAdapter.ts", "utf8");
const uiSource = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const memorySource = fs.readFileSync("src/core/memory.ts", "utf8");

validateAdapterRouting();
validateDashboardRouting();
await validatePublicRoomSnapshot();

if (failures.length > 0) {
  console.error(`Room public memory routing validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room public memory routing validation passed.");

function validateAdapterRouting() {
  const recordObservations = sliceMethod(adapterSource, "recordObservations");
  expect(recordObservations.includes("resolvedVisibility === \"public\""), "recordObservations should detect public messages before observer routing");
  expect(recordObservations.includes("return emptyRoomMemoryAdapterResult()"), "public messages should not create observer entries");
  expect(recordObservations.includes("const visibility = \"private_participant\""), "observer entries should only be private participant visibility");

  const recordRoomMessage = sliceMethod(adapterSource, "recordRoomMessage");
  expect(recordRoomMessage.includes("kind: \"room_message\""), "public messages should still write room_message memory");
  expect(recordRoomMessage.includes("recordDirectorRoomObservationMemory"), "public messages may still feed Director public observation memory");
}

function validateDashboardRouting() {
  expect(uiSource.includes("recentMessages: RoomMemoryMessage[]"), "Memory dashboard scope should carry recent public room messages");
  expect(uiSource.includes("semanticObservations: SemanticMemoryObservation[]"), "Memory dashboard scope should carry semantic observations");
  expect(uiSource.includes("sourceType: \"compressed\" | \"graph\" | \"candidate\" | \"short\" | \"semantic\""), "dashboard facts should distinguish semantic observations");
  expect(uiSource.includes("recentMessages: snapshot.recentMessages"), "public room scope should expose recent public activity");
  expect(uiSource.includes("scope.semanticObservations"), "memory facts should render semantic observations");
  expect(!uiSource.includes("kind: \"public_activity\""), "raw public activity should not render as memory facts");
  expect(uiSource.includes("observerEntries: snapshot.entries.filter((entry) => entry.visibility !== \"public\")"), "observer scopes should hide legacy public observer entries");
}

async function validatePublicRoomSnapshot() {
  const { MemoryStore } = await loadMemoryStoreModule();
  const store = new MemoryStore();
  const now = new Date("2026-06-06T08:00:00.000Z");
  store.recordMemoryEvent({
    kind: "room_message",
    memorySavingEnabled: true,
    input: {
      scope: "room:public-routing",
      speaker: "You",
      text: "大家先聊聊天，随便说两句。",
      source: "user",
      now,
      visibility: "public",
    },
  });

  const snapshot = store.getRoomMemorySnapshot("room:public-routing");
  expect(snapshot.recentMessages.length === 1, "ordinary public chat should appear as recent public activity");
  expect(snapshot.recentMessages[0]?.text.includes("随便说两句"), "recent public activity should keep the message text");
  expect(snapshot.shortTerm.length === 0, "ordinary public chat should not become semantic short-term memory unless it has a fact signal");
  expect(store.processSemanticObservationsForScope("room:public-routing").length === 0, "ordinary chat without semantic signal should not become semantic memory");
  expect(store.listGraphClaimInputs("room:public-routing").length === 0, "ordinary public chat should not become graph fact");
  expect(store.getRoomPromptMemory("room:public-routing").every((line) => !line.includes("随便说两句")), "ordinary public activity should not be injected as prompt fact");
}

async function loadMemoryStoreModule() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-public-memory-routing-"));
  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
  };
  const graphSource = fs
    .readFileSync("src/core/memoryGraph.ts", "utf8")
    .replace(
      'import { invoke } from "@tauri-apps/api/core";',
      'const invoke = async () => { throw new Error("Tauri invoke is unavailable in public memory routing validation."); };',
    );
  const extractionSource = fs.readFileSync("src/core/memoryExtractionPipeline.ts", "utf8");
  fs.writeFileSync(path.join(tempDir, "memoryGraph.mjs"), ts.transpileModule(graphSource, { compilerOptions }).outputText);
  fs.writeFileSync(path.join(tempDir, "memoryExtractionPipeline.mjs"), ts.transpileModule(extractionSource, { compilerOptions }).outputText);
  fs.writeFileSync(
    path.join(tempDir, "memory.mjs"),
    ts
      .transpileModule(memorySource, { compilerOptions })
      .outputText
      .replaceAll("./memoryGraph", "./memoryGraph.mjs")
      .replaceAll("./memoryExtractionPipeline", "./memoryExtractionPipeline.mjs"),
  );
  return import(pathToFileURL(path.join(tempDir, "memory.mjs")).href);
}

function sliceMethod(source, name) {
  const marker = `  ${name}(`;
  let start = source.indexOf(marker);
  if (start < 0) {
    start = source.indexOf(`  private ${name}(`);
  }
  if (start < 0) {
    failures.push(`missing method ${name}`);
    return "";
  }
  const bodyStart = source.indexOf("{", start);
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
  failures.push(`unterminated method ${name}`);
  return source.slice(start);
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
