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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-room-memory-write-"));
  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
  };
  const graphSource = fs
    .readFileSync("src/core/memoryGraph.ts", "utf8")
    .replace(
      'import { invoke } from "@tauri-apps/api/core";',
      'const invoke = async () => { throw new Error("Tauri invoke is unavailable in room memory validation."); };',
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

const store = new MemoryStore();
const now = new Date("2026-05-29T08:00:00.000Z");

store.recordMemoryEvent({
  kind: "room_message",
  memorySavingEnabled: true,
  input: {
    scope: "room:demo",
    speaker: "You",
    text: "记住目标是找到钥匙",
    source: "user",
    now,
  },
});

const publicRoomClaims = store.listGraphClaimInputs("room:demo").filter((claim) => claim.text.includes("钥匙"));
expect(publicRoomClaims.length === 1, `public room memory should export one room claim, got ${publicRoomClaims.length}`);
expect(publicRoomClaims[0]?.visibility === "public", "public room memory should stay public");
expect(store.listGraphClaimInputs("character:demo").length === 0, "room memory should not leak into one-on-one character memory");

store.recordMemoryEvent({
  kind: "room_observation",
  memorySavingEnabled: true,
  input: {
    scope: "room:demo:observer:p1",
    roomScope: "room:demo",
    roleId: "p1",
    speaker: "Mio",
    speakerId: "p1",
    speakerType: "role",
    text: "秘密是钥匙在二楼",
    now,
    importance: 80,
    strategyTags: ["secret"],
    visibility: "private_participant",
  },
});

const observerClaims = store.listGraphClaimInputs("room:demo:observer:p1").filter((claim) => claim.text.includes("钥匙"));
expect(observerClaims.length >= 1, "private observer memory should export observer-scoped graph claims");
expect(observerClaims.every((claim) => claim.visibility === "known_to_roles"), "private observer memory should remain known_to_roles");
expect(store.listGraphClaimInputs("room:demo").every((claim) => claim.visibility === "public"), "private observer memory should not enter public room graph scope");

store.recordMemoryEvent({
  kind: "faction_huddle",
  memorySavingEnabled: true,
  input: {
    scope: "room:demo:faction:red",
    roomScope: "room:demo",
    factionId: "red",
    now,
    thread: {
      id: "thread-red",
      scope: "room:demo:faction:red",
      roomScope: "room:demo",
      factionId: "red",
      summary: "目标：保护钥匙。",
      publicPoints: ["不公开钥匙位置"],
      privateStrategy: "守住二楼。",
      nextSpeakerRoleId: "p1",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      entries: [],
    },
  },
});

const factionClaims = store.listGraphClaimInputs("room:demo:faction:red").filter((claim) => claim.text.includes("钥匙"));
expect(factionClaims.length >= 1, "faction huddle should export faction-scoped graph claims");
expect(factionClaims.every((claim) => claim.visibility === "faction"), "faction huddle claims should remain faction visibility");
expect(store.listGraphClaimInputs("room:demo").filter((claim) => claim.visibility === "faction").length === 0, "faction huddle should not enter public room graph scope");

if (failures.length > 0) {
  console.error(`Room user memory write validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room user memory write validation passed.");
