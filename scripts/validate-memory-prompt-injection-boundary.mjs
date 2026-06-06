import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-memory-prompt-boundary-"));

function transpile(sourcePath, outputName, replacements = []) {
  let source = fs.readFileSync(sourcePath, "utf8");
  for (const [from, to] of replacements) {
    source = source.replace(from, to);
  }
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  const outputPath = path.join(tempDir, outputName);
  fs.writeFileSync(outputPath, js);
  return outputPath;
}

transpile("src/core/memoryGraph.ts", "memoryGraph.mjs", [
  ['import { invoke } from "@tauri-apps/api/core";', 'const invoke = async () => { throw new Error("Tauri invoke unavailable"); };'],
]);
transpile("src/core/memoryExtractionPipeline.ts", "memoryExtractionPipeline.mjs", [
  ['from "./memoryGraph"', 'from "./memoryGraph.mjs"'],
]);
const memoryPath = transpile("src/core/memory.ts", "memory.mjs", [
  ['from "./memoryGraph"', 'from "./memoryGraph.mjs"'],
  ['from "./memoryExtractionPipeline"', 'from "./memoryExtractionPipeline.mjs"'],
]);

const { MemoryStore } = await import(pathToFileURL(memoryPath).href);

const failures = [];
function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const store = new MemoryStore({ shortTermDays: 7, autoWriteLongTermEnabled: true, requireUserConfirmation: true });
const roomScope = "room:belief-room";
const now = new Date("2026-06-05T00:00:00.000Z");

store.recordMemoryEvent({
  kind: "room_observation",
  input: {
    scope: `${roomScope}:observer:archive-3`,
    roomScope,
    roleId: "archive-3",
    speaker: "Archive-3",
    speakerId: "archive-3",
    speakerType: "role",
    text: "钥匙在Archive-3手里。",
    now,
    importance: 70,
    visibility: "public",
    strategyTags: ["claim"],
  },
  scope: `${roomScope}:observer:archive-3`,
  text: "钥匙在Archive-3手里。",
  sourceType: "character_public_message",
  visibility: "public",
  source: {
    sourceScope: roomScope,
    speakerId: "Archive-3",
    speakerType: "role",
    excerpt: "钥匙在Archive-3手里。",
    createdAt: now.toISOString(),
  },
  now,
});

const claimed = store.listGraphClaimsForViewer(`${roomScope}:observer:archive-3`, {
  type: "room_role",
  roomId: "belief-room",
  participantId: "archive-3",
});
expect(claimed.some((claim) => claim.epistemicStatus === "claimed"), "character observation should create claimed graph memory");

const publicPrompt = store.getRoomPromptMemory(roomScope);
expect(!publicPrompt.some((line) => line.includes("钥匙在Archive-3手里")), "claimed room memory must not enter public room prompt as fact");

store.recordMemoryEvent({
  kind: "director",
  input: {
    scope: `${roomScope}:system`,
    roomId: "belief-room",
    text: "钥匙在抽屉里。",
    now,
    move: "judge",
    visibility: "hidden_from_user",
    sourceType: "director_move",
  },
  scope: `${roomScope}:system`,
  text: "钥匙在抽屉里。",
  sourceType: "director_ruling",
  visibility: "director_only",
  directorVisible: true,
  source: {
    sourceScope: `${roomScope}:system`,
    speakerType: "director",
    excerpt: "钥匙在抽屉里。",
    createdAt: now.toISOString(),
  },
  now,
});

const directorClaims = store.listGraphClaimsForViewer(`${roomScope}:system`, {
  type: "director",
  roomId: "belief-room",
});
expect(directorClaims.some((claim) => claim.epistemicStatus === "confirmed" && claim.status === "active"), "Director ruling should create active confirmed graph fact");

const publicDirectorClaims = store.listGraphClaimsForViewer(`${roomScope}:system`, {
  type: "room_public",
  roomId: "belief-room",
});
expect(publicDirectorClaims.length === 0, "director-only confirmed fact must not be visible to public room viewer");

if (failures.length > 0) {
  console.error(`validate-memory-prompt-injection-boundary failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-memory-prompt-injection-boundary passed");
