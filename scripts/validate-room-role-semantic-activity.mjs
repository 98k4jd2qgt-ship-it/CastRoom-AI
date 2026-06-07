import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const failures = [];

await validateRoomRoleSemanticActivity();

if (failures.length > 0) {
  console.error(`Room role semantic activity validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room role semantic activity validation passed.");

async function validateRoomRoleSemanticActivity() {
  const { MemoryStore } = await loadMemoryStoreModule();
  const store = new MemoryStore();
  const roomScope = "room:role-semantic";
  const roleScope = "room:role-semantic:role:new-character-2";
  const characterScope = "character:new-character-2";

  store.recordMemoryEvent({
    kind: "room_message",
    memorySavingEnabled: true,
    input: {
      scope: roomScope,
      speaker: "New Character 2",
      speakerType: "role",
      speakerId: "new-character-2",
      text: "我更倾向先观察一下局势，不急着表态；如果有人回避问题，我会直接质疑。",
      source: "room",
      now: new Date("2026-06-06T09:00:00.000Z"),
      visibility: "public",
    },
  });

  store.processSemanticObservationsForScope(roomScope);

  const roleObservations = store.listSemanticObservations(roleScope);
  expect(roleObservations.length > 0, "role public speech should generate room-role semantic observations");
  expect(
    roleObservations.some((item) => item.kind !== "event"),
    "role observation should capture a specific semantic kind instead of only generic event",
  );
  expect(store.listSemanticObservations(characterScope).length === 0, "room semantic observations must not leak into one-on-one character memory");

  const serialized = store.serialize();
  const restored = new MemoryStore();
  restored.restore(serialized);
  expect(restored.listSemanticObservations(roleScope).length === roleObservations.length, "semantic observations should survive serialize/restore");
}

async function loadMemoryStoreModule() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-role-semantic-"));
  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
  };
  const graphSource = fs
    .readFileSync("src/core/memoryGraph.ts", "utf8")
    .replace(
      'import { invoke } from "@tauri-apps/api/core";',
      'const invoke = async () => { throw new Error("Tauri invoke is unavailable in role semantic validation."); };',
    );
  const extractionSource = fs.readFileSync("src/core/memoryExtractionPipeline.ts", "utf8");
  fs.writeFileSync(path.join(tempDir, "memoryGraph.mjs"), ts.transpileModule(graphSource, { compilerOptions }).outputText);
  fs.writeFileSync(path.join(tempDir, "memoryExtractionPipeline.mjs"), ts.transpileModule(extractionSource, { compilerOptions }).outputText);
  fs.writeFileSync(
    path.join(tempDir, "memory.mjs"),
    ts
      .transpileModule(fs.readFileSync("src/core/memory.ts", "utf8"), { compilerOptions })
      .outputText
      .replaceAll("./memoryGraph", "./memoryGraph.mjs")
      .replaceAll("./memoryExtractionPipeline", "./memoryExtractionPipeline.mjs"),
  );
  return import(pathToFileURL(path.join(tempDir, "memory.mjs")).href);
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
