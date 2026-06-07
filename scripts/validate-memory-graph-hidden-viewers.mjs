import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const failures = [];
const { MemoryStore } = await loadMemoryModule();
const base = new Date("2026-06-05T08:00:00.000Z");

validateObserverGraphVisibility();
validateFactionGraphVisibility();
validateDirectorHiddenGraphVisibility();
validateDashboardUsesViewerAwareGraphClaims();

if (failures.length > 0) {
  console.error(`validate-memory-graph-hidden-viewers failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-memory-graph-hidden-viewers passed");

async function loadMemoryModule() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-hidden-graph-"));
  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
  };
  const graphSource = fs
    .readFileSync("src/core/memoryGraph.ts", "utf8")
    .replace(
      'import { invoke } from "@tauri-apps/api/core";',
      'const invoke = async () => { throw new Error("Tauri invoke is unavailable in hidden graph validation."); };',
    );
  const graphJs = ts.transpileModule(graphSource, { compilerOptions }).outputText.replaceAll("./types", "../../src/core/types");
  const extractionJs = ts.transpileModule(fs.readFileSync("src/core/memoryExtractionPipeline.ts", "utf8"), { compilerOptions }).outputText;
  const memoryJs = ts
    .transpileModule(fs.readFileSync("src/core/memory.ts", "utf8"), { compilerOptions })
    .outputText
    .replaceAll("./memoryGraph", "./memoryGraph.mjs")
    .replaceAll("./memoryExtractionPipeline", "./memoryExtractionPipeline.mjs");
  fs.writeFileSync(path.join(tempDir, "memoryGraph.mjs"), graphJs);
  fs.writeFileSync(path.join(tempDir, "memoryExtractionPipeline.mjs"), extractionJs);
  fs.writeFileSync(path.join(tempDir, "memory.mjs"), memoryJs);
  return import(pathToFileURL(path.join(tempDir, "memory.mjs")).href);
}

function validateObserverGraphVisibility() {
  const store = new MemoryStore();
  const roomScope = "room:hidden-demo";
  const observerScope = `${roomScope}:observer:mio`;
  store.recordMemoryEvent({
    kind: "room_observation",
    input: {
      scope: observerScope,
      roomScope,
      roleId: "mio",
      speaker: "Rin",
      speakerId: "rin",
      speakerType: "role",
      target: { targets: [{ type: "role", roleId: "mio" }] },
      text: "Rin privately tells Mio that key is in the clock.",
      now: base,
      importance: 80,
      strategyTags: ["clue"],
      visibility: "private_participant",
      sourceMessageId: "observer-hidden-1",
    },
  });

  const publicClaims = store.listGraphClaimsForViewer(observerScope, { type: "room_public", roomId: "hidden-demo" });
  const mioClaims = store.listGraphClaimsForViewer(observerScope, { type: "room_role", roomId: "hidden-demo", participantId: "mio" });
  const outsiderClaims = store.listGraphClaimsForViewer(observerScope, { type: "room_role", roomId: "hidden-demo", participantId: "kai" });
  const directorClaims = store.listGraphClaimsForViewer(observerScope, { type: "director", roomId: "hidden-demo" });

  expect(publicClaims.every((claim) => !claim.text.includes("clock")), "public graph must not see private observer claim");
  expect(mioClaims.some((claim) => claim.text.includes("clock")), "target role graph should see private observer claim");
  expect(outsiderClaims.every((claim) => !claim.text.includes("clock")), "other role graph must not see private observer claim");
  expect(directorClaims.some((claim) => claim.text.includes("clock")), "Director graph should see director-visible observer claim");
  expect(store.getRoomPromptMemory(roomScope).every((line) => !line.includes("clock")), "public room prompt memory must not include observer graph claim");
}

function validateFactionGraphVisibility() {
  const store = new MemoryStore();
  const roomScope = "room:faction-hidden-demo";
  const factionScope = `${roomScope}:faction:red`;
  store.recordMemoryEvent({
    kind: "faction_huddle",
    input: {
      scope: factionScope,
      roomScope,
      factionId: "red",
      now: base,
      thread: {
        id: "hidden-huddle-red",
        roomId: "faction-hidden-demo",
        factionId: "red",
        factionName: "Red",
        memberRoleIds: ["mio"],
        entries: [],
        summary: "our strategy is: hide the route map.",
        createdAt: base.toISOString(),
      },
    },
  });

  const publicClaims = store.listGraphClaimsForViewer(factionScope, { type: "room_public", roomId: "faction-hidden-demo" });
  const redClaims = store.listGraphClaimsForViewer(factionScope, { type: "room_faction", roomId: "faction-hidden-demo", factionId: "red" });
  const blueClaims = store.listGraphClaimsForViewer(factionScope, { type: "room_faction", roomId: "faction-hidden-demo", factionId: "blue" });
  const directorClaims = store.listGraphClaimsForViewer(factionScope, { type: "director", roomId: "faction-hidden-demo" });

  expect(publicClaims.every((claim) => !claim.text.includes("route map")), "public graph must not see faction claim");
  expect(redClaims.some((claim) => claim.text.includes("route map")), "same faction graph should see faction claim");
  expect(blueClaims.every((claim) => !claim.text.includes("route map")), "other faction graph must not see faction claim");
  expect(directorClaims.some((claim) => claim.text.includes("route map")), "Director graph should see director-visible faction claim");
  expect(store.getRoomPromptMemory(roomScope).every((line) => !line.includes("route map")), "public room prompt memory must not include faction graph claim");
}

function validateDirectorHiddenGraphVisibility() {
  const store = new MemoryStore();
  const roomScope = "room:director-hidden-demo";
  const directorScope = `${roomScope}:system`;
  store.recordMemoryEvent({
    kind: "director",
    input: {
      scope: directorScope,
      roomScope,
      speaker: "Director",
      text: "hidden fact is: the lever behind the shelf.",
      move: "whisper",
      now: base,
      visibility: "hidden_from_user",
      visibleToRoleIds: ["mio"],
      sourceType: "system_event",
      sourceMessageId: "director-hidden-1",
    },
  });

  const publicClaims = store.listGraphClaimsForViewer(directorScope, { type: "room_public", roomId: "director-hidden-demo" });
  const roleClaims = store.listGraphClaimsForViewer(directorScope, { type: "room_role", roomId: "director-hidden-demo", participantId: "mio" });
  const directorClaims = store.listGraphClaimsForViewer(directorScope, { type: "director", roomId: "director-hidden-demo" });

  expect(publicClaims.every((claim) => !claim.text.includes("lever")), "public graph must not see director_only claim");
  expect(roleClaims.every((claim) => !claim.text.includes("lever")), "role graph must not see director_only claim");
  expect(directorClaims.some((claim) => claim.text.includes("lever")), "Director graph should see director_only claim");
  expect(store.getRoomPromptMemory(roomScope).every((line) => !line.includes("lever")), "public room prompt memory must not include director hidden claim");
}

function validateDashboardUsesViewerAwareGraphClaims() {
  const ui = fs.readFileSync("src/ui/petConsole.ts", "utf8");
  expect(ui.includes("memoryStore.listGraphClaimsForViewer(scope, directorGraphViewer(room))"), "Director memory scope should use Director graph viewer");
  expect(ui.includes("const viewer = roomRoleGraphViewer(room, participant)"), "Role perspective should resolve a role graph viewer");
  expect(ui.includes("graphClaims: dedupeMemoryGraphClaims(graphScopes.flatMap((scope) => memoryStore.listGraphClaimsForViewer(scope, viewer)))"), "Merged role perspective should query every backing scope with the role viewer");
  expect(ui.includes("memoryStore.listGraphClaimsForViewer(snapshot.scope, factionGraphViewer(room, factionId))"), "Faction memory scope should use faction graph viewer");
  expect(!ui.includes("graphClaims: memoryStore.listGraphClaims(snapshot.scope)"), "Hidden dashboard scopes should not use default public graph viewer");
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
