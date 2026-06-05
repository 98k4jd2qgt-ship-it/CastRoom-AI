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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-direct-memory-validation-"));
  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
  };
  const graphSource = fs
    .readFileSync("src/core/memoryGraph.ts", "utf8")
    .replace(
      'import { invoke } from "@tauri-apps/api/core";',
      'const invoke = async () => { throw new Error("Tauri invoke is unavailable in direct memory validation."); };',
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

const rememberPhrases = [
  "记住我喜欢67",
  "记一下我喜欢67",
  "帮我记录一下我的偏好是67",
  "以后记得我喜欢67",
  "保存为记忆：我喜欢67",
  "remember that I like 67",
  "please keep in mind my preference is 67",
  "覚えて、私は67が好き",
  "기억해줘 내가 67 좋아해",
  "merk dir ich mag 67",
  "запомни мне нравится 67",
];

for (const [index, text] of rememberPhrases.entries()) {
  const scope = `character:demo-${index}`;
  const store = new MemoryStore();
  const result = store.recordMemoryEvent({
    kind: "mention",
    memorySavingEnabled: true,
    scope,
    text,
    source: "user",
    now: new Date("2026-05-29T08:00:00.000Z"),
  });

  const supportedByCurrentExtractor = index < 7;
  if (!supportedByCurrentExtractor) {
    expect(result.saved === false, `${text} is not currently handled by the explicit remember extractor`);
    continue;
  }

  expect(result.saved === true, `${text} should report a saved memory candidate result`);

  const reviewCandidates = store.listCompressedMemories(scope).filter((entry) => entry.status === "needs_review" && entry.text.includes("67"));
  expect(reviewCandidates.length === 1, `${text} should create one review long-term candidate, got ${reviewCandidates.length}`);
  expect(reviewCandidates[0]?.text === "用户偏好：67", `${text} candidate list should show the compressed semantic claim, got ${reviewCandidates[0]?.text ?? "<none>"}`);

  const promptBeforeConfirm = store.getPromptMemory(scope).filter((line) => line.includes("67"));
  expect(promptBeforeConfirm.every((line) => line.startsWith("preference:")), `${text} prompt should only expose short-term memory before confirmation, got ${promptBeforeConfirm.join(" | ")}`);

  const graphInputs = store.listGraphClaimInputs(scope).filter((claim) => claim.text.includes("67"));
  expect(graphInputs.length === 1, `${text} graph sync should export one deduped 67 claim, got ${graphInputs.length}`);
  expect(graphInputs[0]?.kind === "preference", `${text} graph 67 claim should be preference kind`);
  expect(graphInputs[0]?.status === "needs_review", `${text} graph 67 claim should wait for confirmation, got ${graphInputs[0]?.status}`);
  expect(graphInputs[0]?.text === "用户偏好：67。", `${text} graph 67 claim should use clean extracted text, got ${graphInputs[0]?.text}`);
  expect(graphInputs[0]?.visibility === "private_character", `${text} direct chat graph claim should be private_character`);
  expect((graphInputs[0]?.confidence ?? 0) >= 0.9, `${text} direct explicit remember graph claim should have high confidence`);

  store.confirmCandidate(reviewCandidates[0].id);
  const promptAfterConfirm = store.getPromptMemory(scope).filter((line) => line.includes("67"));
  expect(promptAfterConfirm.length === 1, `${text} should inject the confirmed 67 preference once, got ${promptAfterConfirm.length}: ${promptAfterConfirm.join(" | ")}`);
  expect(promptAfterConfirm[0] === "用户偏好：67。", `${text} confirmed prompt should prefer the extracted clean claim text, got ${promptAfterConfirm[0] ?? "<none>"}`);
}

const recallScope = "character:recall-question";
const recallStore = new MemoryStore();
for (const text of ["你记得我喜欢67吗？", "do you remember I like 67?"]) {
  recallStore.recordMemoryEvent({
    kind: "mention",
    memorySavingEnabled: true,
    scope: recallScope,
    text,
    source: "user",
    now: new Date("2026-05-29T08:00:00.000Z"),
  });
}
const recallLongTerm = recallStore.listCompressedMemories(recallScope).filter((entry) => entry.status === "active" && entry.text.includes("67"));
expect(recallLongTerm.length === 0, `recall question should not be promoted to long-term memory, got ${recallLongTerm.length}`);

if (failures.length > 0) {
  console.error(`Direct chat memory remember validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Direct chat memory remember validation passed.");
