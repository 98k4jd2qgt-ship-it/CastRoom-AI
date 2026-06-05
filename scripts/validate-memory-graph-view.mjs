import fs from "node:fs";
import { expect, loadMemoryGraphModule } from "./memory-graph-validation-loader.mjs";

const failures = [];

const memoryGraphSource = fs.readFileSync("src/core/memoryGraph.ts", "utf8");
const memoryStoreSource = fs.readFileSync("src/core/memory.ts", "utf8");
const petConsoleSource = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const styleSource = fs.readFileSync("src/styles.css", "utf8");
const rustSource = fs.readFileSync("src-tauri/src/lib.rs", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

for (const marker of [
  "interface MemoryGraphViewModel",
  "interface MemoryGraphViewNode",
  "interface MemoryGraphViewEdge",
  "queryGraphView(context",
]) {
  expect(memoryGraphSource.includes(marker), `memory graph source must expose ${marker}`, failures);
}

for (const marker of [
  "memory_graph_query_view",
  "fn query_memory_graph_view",
  "memory_graph_query_view,",
  'memory_graph_json_optional_string(viewer, "packId")',
  "c.scope = ('character:' || ?8) AND c.visibility = 'private_character'",
]) {
  expect(rustSource.includes(marker), `Tauri memory graph view command must include ${marker}`, failures);
}

for (const marker of [
  "renderMemoryGraphPanel",
  "renderMemoryGraphSvg",
  "memory-view-switch",
  "memory-graph-shell",
  "captureMemoryGraphUiState",
  "console-shell--memory",
  "memory_graph_query_view",
  "shouldUseFallbackMemoryGraphView(graphView, fallbackView, graphState.mode)",
  "function shouldUseFallbackMemoryGraphView",
  "resolveMemoryGraphViewerContext",
]) {
  expect(petConsoleSource.includes(marker), `Memory UI must include graph view marker ${marker}`, failures);
}

for (const marker of [
  "mode: context?.mode",
  "expandedNodeIds: context?.expandedNodeIds",
]) {
  expect(memoryStoreSource.includes(marker), `MemoryStore fallback graph view must preserve ${marker}`, failures);
}

for (const marker of [
  ".console-shell--memory",
  '.console-content[data-view="memory"]',
  ".memory-graph-shell",
  ".memory-graph-svg",
  ".memory-graph-detail",
  "overflow: hidden",
]) {
  expect(styleSource.includes(marker), `Memory graph CSS must include ${marker}`, failures);
}

expect(
  !petConsoleSource.includes("root.replaceWith(nextPanel)"),
  "Memory dashboard store update must not replace the whole panel and reset graph/tree UI state",
  failures,
);
expect(
  petConsoleSource.includes("renderMemoryDashboardContent(content, activeView, memoryStore, state, selectedScope, onMemoryAction, language, graphState)"),
  "Memory dashboard updates should redraw content with preserved graph UI state",
  failures,
);

const dependencies = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
};
for (const forbidden of ["d3", "cytoscape", "vis-network"]) {
  expect(!(forbidden in dependencies), `Memory graph view must not add ${forbidden} dependency`, failures);
}

const { InMemoryMemoryGraphRepository } = await loadMemoryGraphModule();
const repo = new InMemoryMemoryGraphRepository();

const publicClaim = repo.mergeClaimSync({
  scope: "room:graph-room",
  kind: "clue",
  subject: { kind: "item", canonicalKey: "key", displayName: "钥匙" },
  predicate: "located_in",
  object: { kind: "location", canonicalKey: "desk", displayName: "桌子" },
  text: "钥匙在桌子上。",
  visibility: "public",
  confidence: 0.88,
  authority: "director",
  sensitivity: "normal",
  source: { sourceScope: "room:graph-room", roomId: "graph-room", excerpt: "钥匙在桌子上。" },
  conflictPolicy: "merge",
});

const oneOnOneClaim = repo.mergeClaimSync({
  scope: "character:demo",
  kind: "preference",
  subject: { kind: "character_pack", canonicalKey: "demo", displayName: "demo" },
  predicate: "prefers",
  object: { kind: "concept", canonicalKey: "67", displayName: "67" },
  text: "用户偏好：67。",
  visibility: "private_character",
  confidence: 0.95,
  authority: "system",
  sensitivity: "normal",
  source: { sourceScope: "character:demo", excerpt: "记住我喜欢67" },
  conflictPolicy: "merge",
});

const privateClaim = repo.mergeClaimSync({
  scope: "room:graph-room",
  kind: "secret",
  subject: { kind: "clue", canonicalKey: "hidden-door", displayName: "暗门" },
  predicate: "located_in",
  object: { kind: "location", canonicalKey: "basement", displayName: "地下室" },
  text: "暗门在地下室。",
  visibility: "known_to_roles",
  knownToRoleIds: ["mio"],
  directorVisible: true,
  confidence: 0.76,
  authority: "character",
  sensitivity: "private",
  source: { sourceScope: "room:graph-room:observer:mio", roomId: "graph-room", participantId: "mio", excerpt: "暗门在地下室。" },
  conflictPolicy: "merge",
});

const publicView = repo.queryGraphViewSync({
  scope: "room:graph-room",
  viewer: { type: "room_public", roomId: "graph-room" },
  maxNodes: 120,
});
const directorView = repo.queryGraphViewSync({
  scope: "room:graph-room",
  viewer: { type: "director", roomId: "graph-room" },
  maxNodes: 120,
});
const roleView = repo.queryGraphViewSync({
  scope: "room:graph-room",
  viewer: { type: "room_role", roomId: "graph-room", participantId: "mio" },
  maxNodes: 120,
});
const oneOnOneView = repo.queryGraphViewSync({
  scope: "character:demo",
  viewer: { type: "one_on_one", packId: "demo" },
  mode: "browse",
  maxNodes: 120,
});
const wrongPublicView = repo.queryGraphViewSync({
  scope: "character:demo",
  viewer: { type: "room_public", roomId: "graph-room" },
  mode: "browse",
  maxNodes: 120,
});

expect(viewHasClaim(publicView, publicClaim.id), "public graph should include public claim relationship", failures);
expect(publicView.nodes.some((node) => node.kind === "entity" && node.label.includes("钥匙")), "public graph should include public subject entity", failures);
expect(publicView.nodes.every((node) => !node.label.includes("暗门")), "public graph must not expose private claim text", failures);
expect(viewHasClaim(directorView, privateClaim.id), "Director graph should include director-visible private claim", failures);
expect(viewHasClaim(roleView, privateClaim.id), "authorized role graph should include observer claim", failures);
expect(publicView.edges.length > 0, "graph view should include claim/entity edges", failures);
expect(viewHasClaim(oneOnOneView, oneOnOneClaim.id), "one-on-one graph should include private_character claim for selected pack", failures);
expect(wrongPublicView.nodes.every((node) => !node.label.includes("67")), "room public viewer must not read one-on-one private_character claims", failures);
expect(typeof oneOnOneView.visibleClaimCount === "number", "graph view should expose visibleClaimCount", failures);
expect(typeof oneOnOneView.modeClaimCount === "number", "graph view should expose modeClaimCount", failures);

if (failures.length > 0) {
  console.error(`Memory graph view validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory graph view validation passed.");

function viewHasClaim(view, claimId) {
  return view.nodes.some((node) => node.sourceClaimId === claimId) || view.edges.some((edge) => edge.sourceClaimId === claimId);
}
