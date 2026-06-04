import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const source = fs.readFileSync("src/core/memory.ts", "utf8");
const graphSource = fs
  .readFileSync("src/core/memoryGraph.ts", "utf8")
  .replace(
    'import { invoke } from "@tauri-apps/api/core";',
    'const invoke = async () => { throw new Error("Tauri invoke is unavailable in memory artifact validation."); };',
  );
const extractionSource = fs.readFileSync("src/core/memoryExtractionPipeline.ts", "utf8");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-memory-artifact-validation-"));
const compilerOptions = {
  module: ts.ModuleKind.ES2022,
  target: ts.ScriptTarget.ES2022,
  importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
};
const graphJs = ts.transpileModule(graphSource, { compilerOptions }).outputText.replaceAll("./types", "../../src/core/types");
const extractionJs = ts.transpileModule(extractionSource, { compilerOptions }).outputText;
const js = ts
  .transpileModule(source, { compilerOptions })
  .outputText
  .replaceAll("./memoryGraph", "./memoryGraph.mjs")
  .replaceAll("./memoryExtractionPipeline", "./memoryExtractionPipeline.mjs");
fs.writeFileSync(path.join(tempDir, "memoryGraph.mjs"), graphJs);
fs.writeFileSync(path.join(tempDir, "memoryExtractionPipeline.mjs"), extractionJs);
fs.writeFileSync(path.join(tempDir, "memory.mjs"), js);

const moduleUrl = pathToFileURL(path.join(tempDir, "memory.mjs")).href;
const {
  MemoryStore,
  cleanCorruptedRoomMemoryData,
  extractMemoryAtoms,
  isMemoryArtifactText,
  shouldAcceptRoomMemoryText,
  updateRollingSummary,
} = await import(moduleUrl);

const failures = [];
const base = new Date("2026-05-21T08:00:00.000Z");

validateArtifactDetection();
validateArtifactWriteRejection();
validateValidRoomFactStillWorks();
validateRollingSummaryFiltering();
validateCorruptedDataCleaning();

if (failures.length > 0) {
  console.error(`Memory artifact filter validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory artifact filter validation passed");

function validateArtifactDetection() {
  const repeated = "房间相关事实：房间相关事实：房间相关事实：钥匙在 Mio 手里。";
  const summary = "Room summary: scene: 房间相关事实：门开着 | preference: 用户偏好简短回复。";
  const status = "Director choice: pick a role to act, continue a clue, or let the room flow.";

  expect(isMemoryArtifactText(repeated), "repeated room memory prefix should be classified as artifact");
  expect(isMemoryArtifactText(summary), "rolling summary text should be classified as artifact");
  expect(isMemoryArtifactText(status), "Director choice/status text should be classified as artifact");
  expect(!isMemoryArtifactText("钥匙在 Mio 手里。"), "plain semantic room fact should not be classified as artifact");
}

function validateArtifactWriteRejection() {
  const store = new MemoryStore();
  const scope = "room:artifact-room";
  const artifact = "房间相关事实：房间相关事实：房间相关事实：房间相关事实：场景保持不变。";

  expect(!shouldAcceptRoomMemoryText(artifact, "room"), "artifact room text should be rejected before write");
  expect(extractMemoryAtoms(artifact, { scope, source: "room" }).length === 0, "artifact text should not create memory atoms");

  store.recordMemoryEvent({
    kind: "room_message",
    memorySavingEnabled: true,
    input: {
      scope,
      speaker: "Director",
      text: artifact,
      source: "room",
      now: base,
      visibility: "public",
      channelId: "public",
    },
  });

  const snapshot = store.getRoomMemorySnapshot(scope);
  expect(store.listShortTerm(scope).length === 0, "artifact text should not create short-term room memory");
  expect(!snapshot.summary.includes("房间相关事实"), "artifact text should not enter room rolling summary");
}

function validateValidRoomFactStillWorks() {
  const store = new MemoryStore();
  const scope = "room:valid-room";

  store.recordRoomMessage({
    scope,
    speaker: "Rin",
    text: "钥匙交给 Mio",
    source: "room",
    now: base,
    visibility: "public",
    channelId: "public",
  });

  expect(store.listShortTerm(scope).some((item) => item.normalizedText === "钥匙在 Mio 手里。"), "valid item continuity should still become room memory");
}

function validateRollingSummaryFiltering() {
  const summary = updateRollingSummary("room:demo", [
    "scene: 房间相关事实：房间相关事实：重复污染",
    "item: 钥匙在 Mio 手里。",
  ]);

  expect(!summary.includes("房间相关事实"), "rolling summary should filter memory artifact lines");
  expect(summary.includes("钥匙在 Mio 手里"), "rolling summary should keep valid semantic facts");
}

function validateCorruptedDataCleaning() {
  const cleaned = cleanCorruptedRoomMemoryData({
    mentions: [
      {
        id: "bad",
        scope: "room:demo",
        kind: "scene",
        subject: "room:demo",
        normalizedText: "房间相关事实：房间相关事实：重复污染",
        normalizedKey: "scene:room:demo:bad",
        source: "room",
        count: 2,
        confidence: 0.7,
        sensitivity: "normal",
        sourceMessageIds: ["msg-bad"],
        firstSeenAt: base.toISOString(),
        lastSeenAt: base.toISOString(),
        expiresAt: base.toISOString(),
      },
      {
        id: "good",
        scope: "room:demo",
        kind: "item",
        subject: "mio",
        normalizedText: "钥匙在 Mio 手里。",
        normalizedKey: "item:mio:item_钥匙",
        source: "room",
        count: 1,
        confidence: 0.8,
        sensitivity: "normal",
        sourceMessageIds: ["msg-good"],
        firstSeenAt: base.toISOString(),
        lastSeenAt: base.toISOString(),
        expiresAt: base.toISOString(),
      },
    ],
    compressedMemories: [],
    candidates: [],
    rollingSummaries: [
      {
        scope: "room:demo",
        text: "Room summary: scene: 房间相关事实：房间相关事实：重复污染",
        sourceIds: ["bad"],
        messageCount: 1,
        updatedAt: base.toISOString(),
      },
    ],
    versionHistory: [],
    roomMessages: [],
    roomDirectorMemories: [],
    roomObserverMemories: [],
    roomFactionMemories: [],
  });

  expect(cleaned.mentions.length === 1 && cleaned.mentions[0].id === "good", "cleaning should remove only corrupted short-term mentions");
  expect(cleaned.rollingSummaries.length === 0, "cleaning should remove corrupted rolling summaries");
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
