import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const failures = [];

await validateSemanticExtraction();

if (failures.length > 0) {
  console.error(`Room semantic memory extraction validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room semantic memory extraction validation passed.");

async function validateSemanticExtraction() {
  const { MemoryStore } = await loadMemoryStoreModule("semantic-memory-extraction");
  const store = new MemoryStore();
  const roomScope = "room:semantic-demo";
  const now = new Date("2026-06-06T08:00:00.000Z");

  store.recordMemoryEvent({
    kind: "room_message",
    memorySavingEnabled: true,
    input: {
      scope: roomScope,
      speaker: "Archive-3",
      speakerType: "role",
      speakerId: "archive-3",
      text: "我怀疑 Care-4 的说法不可靠，他总是在回避钥匙到底在哪里。",
      source: "room",
      now,
      visibility: "public",
    },
  });

  const saved = store.processSemanticObservationsForScope(roomScope);
  const roomObservations = store.listSemanticObservations(roomScope);
  const roleObservations = store.listSemanticObservations("room:semantic-demo:role:archive-3");

  expect(saved.length >= 2, "public role message should generate room and role semantic observations");
  expect(roomObservations.some((item) => item.kind === "reliability" || item.kind === "doubt"), "room observations should classify doubt/reliability");
  expect(roleObservations.some((item) => item.subjectId === "archive-3"), "role scope should receive speaker-owned semantic observation");
  expect(store.getRoomPromptMemory(roomScope).some((line) => /claims|doubts|Observed/.test(line)), "semantic observations should be available to prompt with source/status language");

  store.recordMemoryEvent({
    kind: "room_message",
    memorySavingEnabled: true,
    input: {
      scope: roomScope,
      speaker: "You",
      speakerType: "user",
      speakerId: "local-user",
      text: "我的 API key 是 sk-test-secret，记住它。",
      source: "user",
      now: new Date(now.getTime() + 1000),
      visibility: "public",
    },
  });
  store.processSemanticObservationsForScope(roomScope);
  expect(
    store.listSemanticObservations(roomScope).every((item) => !/sk-test-secret|api key/i.test(item.text)),
    "forbidden secrets must not enter semantic observations",
  );
}

async function loadMemoryStoreModule(label) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `castroom-${label}-`));
  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
  };
  const graphSource = fs
    .readFileSync("src/core/memoryGraph.ts", "utf8")
    .replace(
      'import { invoke } from "@tauri-apps/api/core";',
      'const invoke = async () => { throw new Error("Tauri invoke is unavailable in semantic memory validation."); };',
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
