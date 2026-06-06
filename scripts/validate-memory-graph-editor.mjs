import fs from "node:fs";
import { expect, loadMemoryGraphModule } from "./memory-graph-validation-loader.mjs";

const failures = [];

const graph = fs.readFileSync("src/core/memoryGraph.ts", "utf8");
const rust = fs.readFileSync("src-tauri/src/lib.rs", "utf8");
const petConsole = fs.readFileSync("src/ui/petConsole.ts", "utf8");

for (const marker of [
  "MemoryGraphClaimPatch",
  "MemoryGraphConflictResolutionInput",
  "updateClaim(patch",
  "createClaim(input",
  "createEdge(input",
  "deleteEdge(edgeId",
  "resolveConflict(input",
]) {
  expect(graph.includes(marker), `memory graph editor API must include ${marker}`, failures);
}

for (const command of [
  "memory_graph_update_claim",
  "memory_graph_create_claim",
  "memory_graph_archive_claim",
  "memory_graph_delete_claim",
  "memory_graph_create_edge",
  "memory_graph_delete_edge",
  "memory_graph_query_neighbors",
  "memory_graph_query_conflicts",
  "memory_graph_resolve_conflict",
]) {
  expect(rust.includes(command), `Tauri graph editor command must include ${command}`, failures);
}

for (const marker of [
  "memory_graph_query_view",
  "memory_graph_update_claim",
  "memory_graph_create_claim",
  "memory_graph_create_edge",
  'invoke("memory_graph_archive_claim"',
  'invoke("memory_graph_delete_claim"',
  'invoke("memory_graph_resolve_conflict"',
  "resolveMemoryGraphViewerContext",
  "renderMemoryGraphEditorPanel",
  "renderMemoryGraphConflictPanel",
  "truthStatus",
  "epistemicStatus",
  "memoryGraphEpistemicOptions",
  "room_faction",
]) {
  expect(petConsole.includes(marker) || graph.includes(marker), `graph editor UI must include ${marker}`, failures);
}

expect(
  petConsole.indexOf("memory_graph_update_claim") < petConsole.lastIndexOf('type: "editMemory"'),
  "graph detail save should try SQLite graph mutation before legacy fallback",
  failures,
);

const { InMemoryMemoryGraphRepository } = await loadMemoryGraphModule();
const repo = new InMemoryMemoryGraphRepository();

const first = repo.mergeClaimSync({
  scope: "room:editor-room",
  kind: "fact",
  subject: { kind: "item", canonicalKey: "key", displayName: "钥匙" },
  predicate: "located_in",
  object: { kind: "location", canonicalKey: "desk", displayName: "桌子" },
  text: "钥匙在桌子上。",
  visibility: "public",
  confidence: 0.7,
  authority: "director",
  sensitivity: "normal",
  source: { sourceScope: "room:editor-room", excerpt: "钥匙在桌子上。" },
  conflictPolicy: "merge",
});

const updated = await repo.updateClaim({
  claimId: first.id,
  text: "钥匙在抽屉里。",
  kind: "clue",
  predicate: "located_in",
  confidence: 0.92,
  status: "active",
  epistemicStatus: "believed",
});

expect(updated.text === "钥匙在抽屉里。", "updateClaim should update claim text", failures);
expect(updated.kind === "clue", "updateClaim should update claim kind", failures);
expect(Math.round(updated.confidence * 100) === 92, "updateClaim should update confidence", failures);
expect(updated.epistemicStatus === "believed", "updateClaim should update epistemic status", failures);

await repo.archiveClaim(first.id);
const archived = repo.listAllClaimsSync("room:editor-room").find((claim) => claim.id === first.id);
expect(archived?.status === "archived", "archiveClaim should mark claim archived, not delete it", failures);

await repo.deleteClaim(first.id);
expect(!repo.listAllClaimsSync("room:editor-room").some((claim) => claim.id === first.id), "deleteClaim should remove claim", failures);

const left = repo.mergeClaimSync({
  scope: "room:editor-room",
  kind: "fact",
  subject: { kind: "item", canonicalKey: "door", displayName: "门" },
  predicate: "located_in",
  object: { kind: "location", canonicalKey: "north", displayName: "北侧" },
  text: "门在北侧。",
  visibility: "public",
  confidence: 0.6,
  authority: "character",
  sensitivity: "normal",
  source: { sourceScope: "room:editor-room", excerpt: "门在北侧。" },
  conflictPolicy: "merge",
});
const right = repo.mergeClaimSync({
  scope: "room:editor-room",
  kind: "fact",
  subject: { kind: "item", canonicalKey: "door", displayName: "门" },
  predicate: "located_in",
  object: { kind: "location", canonicalKey: "south", displayName: "南侧" },
  text: "门在南侧。",
  visibility: "public",
  confidence: 0.9,
  authority: "director",
  sensitivity: "normal",
  source: { sourceScope: "room:editor-room", excerpt: "门在南侧。" },
  conflictPolicy: "dispute",
});
await repo.resolveConflict({ winnerClaimId: right.id, loserClaimIds: [left.id], action: "supersede" });
const resolvedClaims = repo.listAllClaimsSync("room:editor-room");
expect(resolvedClaims.find((claim) => claim.id === right.id)?.status === "active", "resolveConflict should keep winner active", failures);
expect(resolvedClaims.find((claim) => claim.id === left.id)?.status === "superseded", "resolveConflict should supersede losers", failures);

if (failures.length > 0) {
  console.error(`Memory graph editor validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory graph editor validation passed.");
