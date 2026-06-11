import fs from "node:fs";
import { expect, loadMemoryGraphModule } from "./memory-graph-validation-loader.mjs";

const failures = [];

const graph = fs.readFileSync("src/core/memoryGraph.ts", "utf8");
const petConsole = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const rust = fs.readFileSync("src-tauri/src/lib.rs", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");

for (const marker of [
  "MemoryGraphGovernanceMode",
  "interface MemoryGraphIssue",
  "queryIssues(context",
  "mergeClaims(input",
  "updateVisibility(input",
  "buildMemoryGraphIssues",
]) {
  expect(graph.includes(marker), `memory graph governance API must include ${marker}`, failures);
}

for (const command of [
  "memory_graph_query_issues",
  "memory_graph_merge_claims",
  "memory_graph_update_visibility",
]) {
  expect(rust.includes(command), `Tauri graph governance command must include ${command}`, failures);
}

for (const marker of [
  "memoryGraphGovernanceModeOptions",
  "renderMemoryGraphGovernanceSummary",
  "decorateMemoryGraphViewWithIssues",
  "memoryGraphClaimEvidenceSummary",
  "memoryGraphNodeEvidenceSummary",
  "memory-graph-conflict-evidence",
  "memory_graph_merge_claims",
  'mode: graphState.mode',
]) {
  expect(petConsole.includes(marker), `Memory graph governance UI must include ${marker}`, failures);
}

for (const marker of [
  ".memory-graph-governance-summary",
  ".memory-graph-governance-chip",
  ".memory-graph-issue-row",
  ".memory-graph-conflict-evidence",
  '.memory-graph-node[data-kind="issue"]',
]) {
  expect(styles.includes(marker), `Memory graph governance CSS must include ${marker}`, failures);
}

const { InMemoryMemoryGraphRepository } = await loadMemoryGraphModule();
const repo = new InMemoryMemoryGraphRepository();

const base = {
  scope: "room:governance-room",
  subject: { kind: "item", canonicalKey: "key", displayName: "钥匙" },
  predicate: "located_in",
  object: { kind: "location", canonicalKey: "desk", displayName: "桌子" },
  text: "钥匙在桌子上。",
  confidence: 0.7,
  sensitivity: "normal",
  source: { sourceScope: "room:governance-room", excerpt: "钥匙在桌子上。" },
};

const duplicateA = repo.mergeClaimSync({
  ...base,
  kind: "fact",
  visibility: "public",
  authority: "director",
  conflictPolicy: "merge",
});
const duplicateB = repo.mergeClaimSync({
  ...base,
  kind: "fact",
  visibility: "global",
  authority: "director",
  conflictPolicy: "merge",
});

const conflictLeft = repo.mergeClaimSync({
  scope: "room:governance-room",
  kind: "fact",
  subject: { kind: "item", canonicalKey: "door", displayName: "门" },
  predicate: "located_in",
  object: { kind: "location", canonicalKey: "north", displayName: "北侧" },
  text: "门在北侧。",
  visibility: "public",
  confidence: 0.6,
  authority: "character",
  sensitivity: "normal",
  source: { sourceScope: "room:governance-room", excerpt: "门在北侧。" },
  conflictPolicy: "merge",
});
const conflictRight = repo.mergeClaimSync({
  scope: "room:governance-room",
  kind: "fact",
  subject: { kind: "item", canonicalKey: "door", displayName: "门" },
  predicate: "located_in",
  object: { kind: "location", canonicalKey: "south", displayName: "南侧" },
  text: "门在南侧。",
  visibility: "public",
  confidence: 0.64,
  authority: "character",
  sensitivity: "normal",
  source: { sourceScope: "room:governance-room", excerpt: "门在南侧。" },
  conflictPolicy: "dispute",
});

repo.mergeClaimSync({
  scope: "room:governance-room",
  kind: "secret",
  subject: { kind: "clue", canonicalKey: "hidden-door", displayName: "暗门" },
  predicate: "mentions",
  text: "暗门在地下室。",
  visibility: "public",
  confidence: 0.9,
  authority: "system",
  sensitivity: "private",
  source: { sourceScope: "room:governance-room", excerpt: "暗门在地下室。" },
  conflictPolicy: "merge",
});

repo.mergeClaimSync({
  scope: "room:governance-room",
  kind: "fact",
  subject: { kind: "concept", canonicalKey: "rumor", displayName: "传闻" },
  predicate: "mentions",
  text: "有人说窗户会唱歌。",
  visibility: "public",
  confidence: 0.32,
  authority: "character",
  sensitivity: "normal",
  source: { sourceScope: "room:governance-room", excerpt: "有人说窗户会唱歌。" },
  conflictPolicy: "merge",
});

const baseContext = {
  scope: "room:governance-room",
  viewer: { type: "room_public", roomId: "governance-room" },
  maxNodes: 120,
  includeDisputed: true,
};

const browseView = repo.queryGraphViewSync({ ...baseContext, mode: "browse" });
expect(browseView.mode === "browse", "browse graph view should preserve governance mode", failures);
expect(browseView.issues?.some((issue) => issue.kind === "duplicate"), "governance issues should include duplicate", failures);
expect(browseView.issues?.some((issue) => issue.kind === "conflict"), "governance issues should include conflict", failures);
expect(browseView.issues?.some((issue) => issue.kind === "visibility_leak"), "governance issues should include visibility leak", failures);
expect(browseView.issues?.some((issue) => issue.kind === "low_quality"), "governance issues should include low quality", failures);

const duplicateView = repo.queryGraphViewSync({ ...baseContext, mode: "duplicates" });
expect(viewHasClaim(duplicateView, duplicateA.id), "duplicates mode should keep duplicate winner candidate", failures);
expect(viewHasClaim(duplicateView, duplicateB.id), "duplicates mode should keep duplicate merge candidate", failures);
expect(!viewHasClaim(duplicateView, conflictLeft.id), "duplicates mode should filter unrelated conflicts", failures);

const conflictView = repo.queryGraphViewSync({ ...baseContext, mode: "conflicts" });
expect(viewHasClaim(conflictView, conflictLeft.id), "conflicts mode should include left conflict claim", failures);
expect(viewHasClaim(conflictView, conflictRight.id), "conflicts mode should include right conflict claim", failures);

const merged = await repo.mergeClaims({ winnerClaimId: duplicateA.id, duplicateClaimIds: [duplicateB.id], changedBy: "test" });
expect(merged.evidenceCount >= duplicateA.evidenceCount + duplicateB.evidenceCount, "mergeClaims should combine evidence count", failures);
expect(repo.listAllClaimsSync("room:governance-room").find((claim) => claim.id === duplicateB.id)?.status === "archived", "mergeClaims should archive duplicate claims", failures);

const updated = await repo.updateVisibility({ claimId: duplicateA.id, visibility: "director_only", directorVisible: true, changedBy: "test" });
expect(updated.visibility === "director_only", "updateVisibility should update claim visibility", failures);

if (failures.length > 0) {
  console.error(`Memory graph governance validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory graph governance validation passed.");

function viewHasClaim(view, claimId) {
  return view.nodes.some((node) => node.sourceClaimId === claimId) || view.edges.some((edge) => edge.sourceClaimId === claimId);
}
