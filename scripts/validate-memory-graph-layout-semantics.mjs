import fs from "node:fs";
import { expect, loadMemoryGraphModule } from "./memory-graph-validation-loader.mjs";

const failures = [];
const memoryGraphSource = fs.readFileSync("src/core/memoryGraph.ts", "utf8");
const petConsoleSource = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const rustSource = fs.readFileSync("src-tauri/src/lib.rs", "utf8");

for (const marker of [
  'entityRole?: "subject" | "object" | "related"',
  'memoryGraphEntityViewNode(subject, "subject"',
  'memoryGraphEntityViewNode(object, "object"',
  "extractMemoryGraphPreferenceObjectLabel",
  "shouldHideMemoryGraphObjectNode",
]) {
  expect(memoryGraphSource.includes(marker), `Memory graph ViewModel should include layout semantic marker ${marker}`, failures);
}

for (const marker of [
  "memory_graph_entity_view_node_with_role(&subject, \"subject\"",
  "memory_graph_entity_view_node_with_role(&object, \"object\"",
  "memory_graph_should_hide_object_node",
  "memory_graph_preference_object_label",
  '"entityRole": entity_role',
]) {
  expect(rustSource.includes(marker), `Tauri graph ViewModel should include layout semantic marker ${marker}`, failures);
}

for (const marker of [
  "type MemoryGraphLayoutColumn",
  '"subject"',
  '"object"',
  '"related"',
  "memoryGraphEdgeConnectionPoints",
  "group.dataset.entityRole",
]) {
  expect(petConsoleSource.includes(marker), `Memory graph layout renderer should include ${marker}`, failures);
}

const { InMemoryMemoryGraphRepository } = await loadMemoryGraphModule();
const repo = new InMemoryMemoryGraphRepository();
repo.mergeClaimSync({
  scope: "character:demo",
  kind: "preference",
  subject: { kind: "character_pack", canonicalKey: "demo", displayName: "demo" },
  predicate: "prefers",
  object: { kind: "concept", canonicalKey: "67", displayName: "preference: 用户偏好：67" },
  text: "preference: 用户偏好：67",
  visibility: "private_character",
  confidence: 0.95,
  authority: "system",
  sensitivity: "normal",
  source: { sourceScope: "character:demo", excerpt: "记住我喜欢67" },
  conflictPolicy: "merge",
});

const view = repo.queryGraphViewSync({
  scope: "character:demo",
  viewer: { type: "one_on_one", packId: "demo" },
  mode: "browse",
  maxNodes: 120,
});

const claimNodes = view.nodes.filter((node) => node.kind === "claim" && node.label.includes("67"));
expect(claimNodes.length === 1, "Preference memory should render as exactly one claim node containing 67", failures);

const entityNodes = view.nodes.filter((node) => node.kind === "entity");
expect(entityNodes.some((node) => node.entityRole === "subject"), "Graph should mark the character/user entity as subject", failures);
const objectNodes = entityNodes.filter((node) => node.entityRole === "object");
expect(
  objectNodes.every((node) => !node.label.includes("preference") && !node.label.includes("用户偏好")),
  "Preference object entity should not duplicate the full claim text",
  failures,
);
expect(
  objectNodes.length === 0 || objectNodes.some((node) => node.label === "67" || node.label.includes("67")),
  "If a preference object is shown, it should be the concise value rather than the whole claim",
  failures,
);

if (failures.length > 0) {
  console.error(`Memory graph layout semantics validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory graph layout semantics validation passed.");
