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

async function loadMemoryModules() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-semantic-memory-compression-"));
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
  const extraction = await import(pathToFileURL(path.join(tempDir, "memoryExtractionPipeline.mjs")).href);
  const memory = await import(pathToFileURL(path.join(tempDir, "memory.mjs")).href);
  return { extraction, memory };
}

const { extraction, memory } = await loadMemoryModules();
const { buildMemoryWritePlan } = extraction;
const { MemoryStore } = memory;

const chinesePlan = buildMemoryWritePlan({
  scope: "character:semantic-demo",
  text: "记住我喜欢67",
  sourceType: "user_explicit_remember",
  source: {
    sourceScope: "character:semantic-demo",
    excerpt: "记住我喜欢67",
    createdAt: "2026-05-30T00:00:00.000Z",
  },
});
expect(chinesePlan.claims.length === 1, `Chinese explicit remember should produce one semantic claim, got ${chinesePlan.claims.length}`);
expect(chinesePlan.claims[0]?.text === "用户偏好：67。", `Chinese explicit remember should compress to clean preference, got ${chinesePlan.claims[0]?.text ?? "<none>"}`);
expect(chinesePlan.claims[0]?.source.excerpt === "记住我喜欢67", "source excerpt should preserve original wording only as evidence");

const englishPlan = buildMemoryWritePlan({
  scope: "character:semantic-demo",
  text: "remember that I like 67",
  sourceType: "user_explicit_remember",
});
expect(englishPlan.claims[0]?.text === "用户偏好：67。", `English remember should compress to the same semantic claim, got ${englishPlan.claims[0]?.text ?? "<none>"}`);

const recallPlan = buildMemoryWritePlan({
  scope: "character:semantic-demo",
  text: "你记得我喜欢67吗？",
  sourceType: "user_explicit_remember",
});
expect(recallPlan.claims.length === 0, "recall questions should not write new long-term memory");
expect(recallPlan.skippedReason === "recall_question", `recall questions should be marked recall_question, got ${recallPlan.skippedReason ?? "<none>"}`);

const sensitivePlan = buildMemoryWritePlan({
  scope: "character:semantic-demo",
  text: "记住我的 API key 是 sk-test-secret",
  sourceType: "user_explicit_remember",
});
expect(sensitivePlan.claims.length === 0, "API keys and secrets should be filtered before graph writes");
expect(sensitivePlan.skippedReason === "filtered", `sensitive secret should be filtered, got ${sensitivePlan.skippedReason ?? "<none>"}`);

const stancePlan = buildMemoryWritePlan({
  scope: "room:debate-demo",
  text: "New Character 4 反对「恐龙的命是命」。",
  sourceType: "character_public_message",
  source: {
    sourceScope: "room:debate-demo",
    speakerId: "role-4",
    speakerType: "role",
    excerpt: "New Character 4 反对「恐龙的命是命」。",
    createdAt: "2026-05-30T00:00:00.000Z",
  },
});
expect(stancePlan.claims.length === 1, `debate stance should create one compressed claim, got ${stancePlan.claims.length}`);
expect(
  stancePlan.claims[0]?.text === "立场：New Character 4 反对「恐龙的命是命」。",
  `debate stance should use contextual semantic text, got ${stancePlan.claims[0]?.text ?? "<none>"}`,
);

const store = new MemoryStore();
for (const text of ["记住我喜欢67", "记住我喜欢67", "remember that I like 67", "我喜欢67"]) {
  store.recordMemoryEvent({
    kind: "mention",
    memorySavingEnabled: true,
    scope: "character:semantic-demo",
    text,
    source: "user",
    now: new Date("2026-05-30T00:00:00.000Z"),
  });
}

const compressed = store.listCompressedMemories("character:semantic-demo").filter((entry) => entry.text.includes("67"));
expect(compressed.length === 1, `legacy list should show one deduped compressed preference, got ${compressed.length}: ${compressed.map((entry) => entry.text).join(" | ")}`);
expect(compressed[0]?.text === "用户偏好：67", `legacy list should show compressed claim text, got ${compressed[0]?.text ?? "<none>"}`);
expect(
  !compressed.some((entry) => /用户相关事实|角色相关事实|房间相关事实|^preference\s*:/i.test(entry.text)),
  `legacy compressed memory should not keep wrapped raw text: ${compressed.map((entry) => entry.text).join(" | ")}`,
);

const promptLines = store.getPromptMemory("character:semantic-demo").filter((line) => line.includes("67"));
expect(promptLines.length === 1, `prompt memory should inject one semantic claim, got ${promptLines.length}: ${promptLines.join(" | ")}`);
expect(promptLines[0] === "用户偏好：67。", `prompt memory should inject clean claim text, got ${promptLines[0] ?? "<none>"}`);

const graphClaims = store.listGraphClaimInputs("character:semantic-demo").filter((claim) => claim.text.includes("67"));
expect(graphClaims.length === 1, `graph/list export should expose one semantic preference claim, got ${graphClaims.length}`);
expect(graphClaims[0]?.text === "用户偏好：67。", `graph claim should use clean text, got ${graphClaims[0]?.text ?? "<none>"}`);
expect(graphClaims[0]?.source.excerpt.length > 0, "graph claim should retain source excerpt as evidence");

if (failures.length > 0) {
  console.error("Semantic memory compression validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Semantic memory compression validation passed.");
