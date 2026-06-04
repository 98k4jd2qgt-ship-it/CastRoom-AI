import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const failures = [];

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

async function loadMemoryStoreModule() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-memory-prompt-dedup-"));
  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
  };
  const graphSource = fs
    .readFileSync("src/core/memoryGraph.ts", "utf8")
    .replace(
      'import { invoke } from "@tauri-apps/api/core";',
      'const invoke = async () => { throw new Error("Tauri invoke is unavailable in prompt dedup validation."); };',
    );
  const extractionSource = fs.readFileSync("src/core/memoryExtractionPipeline.ts", "utf8");
  const memorySource = fs.readFileSync("src/core/memory.ts", "utf8");
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

const { MemoryStore } = await loadMemoryStoreModule();

const scope = "character:demo";
const store = new MemoryStore();
for (const text of ["记住我喜欢67", "记住我喜欢67", "remember that I like 67", "我喜欢67"]) {
  store.recordMemoryEvent({
    kind: "mention",
    memorySavingEnabled: true,
    scope,
    text,
    source: "user",
    now: new Date("2026-05-29T08:00:00.000Z"),
  });
}

const promptMemory = store.getPromptMemory(scope);
const linesWith67 = promptMemory.filter((line) => line.includes("67"));
expect(linesWith67.length === 1, `prompt should dedupe graph, legacy and short-term variants for 67, got ${linesWith67.length}: ${promptMemory.join(" | ")}`);
expect(linesWith67[0] === "用户偏好：67。", `prompt should keep the clean extracted 67 fact, got ${linesWith67[0] ?? "<none>"}`);

const graphInputs = store.listGraphClaimInputs(scope).filter((claim) => claim.text.includes("67"));
expect(graphInputs.length === 1, `graph claim export should dedupe repeated 67 variants, got ${graphInputs.length}`);
expect(graphInputs[0]?.authority === "user", "deduped graph claim should prefer user extraction over legacy system compressed memory");

const longTerm = store.listCompressedMemories(scope).filter((entry) => entry.text.includes("67"));
expect(longTerm.length === 1, `long-term list should show one graph-first compressed entry, got ${longTerm.length}: ${longTerm.map((entry) => entry.text).join(" | ")}`);

const numericScope = "character:numeric-preference";
const numericStore = new MemoryStore();
for (const text of ["记住我偏好是8这个数字", "记住我偏好是8", "我的偏好是8"]) {
  numericStore.recordMemoryEvent({
    kind: "mention",
    memorySavingEnabled: true,
    scope: numericScope,
    text,
    source: "user",
    now: new Date("2026-05-30T04:14:00.000Z"),
  });
}

const numericPromptMemory = numericStore.getPromptMemory(numericScope);
const numericLines = numericPromptMemory.filter((line) => line.includes("8"));
expect(
  numericLines.length === 1,
  `prompt should dedupe equivalent numeric preference variants, got ${numericLines.length}: ${numericPromptMemory.join(" | ")}`,
);
expect(numericLines[0] === "用户偏好：8。", `numeric preference prompt should keep normalized value 8, got ${numericLines[0] ?? "<none>"}`);

const numericGraphInputs = numericStore.listGraphClaimInputs(numericScope).filter((claim) => claim.text.includes("8"));
expect(numericGraphInputs.length === 1, `graph claim export should dedupe equivalent numeric preference variants, got ${numericGraphInputs.length}`);
expect(numericGraphInputs[0]?.text === "用户偏好：8。", `graph claim should normalize numeric preference text, got ${numericGraphInputs[0]?.text}`);

if (failures.length > 0) {
  console.error(`Memory prompt dedup validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory prompt dedup validation passed.");
