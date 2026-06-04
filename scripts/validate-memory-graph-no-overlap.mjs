import fs from "node:fs";
import { expect, loadMemoryGraphModule } from "./memory-graph-validation-loader.mjs";

const failures = [];
const petConsoleSource = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const memoryGraphSource = fs.readFileSync("src/core/memoryGraph.ts", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");

expect(
  !petConsoleSource.includes('classList.add("memory-graph-edge-label")'),
  "Graph renderer should not draw relationship text labels into the canvas by default",
  failures,
);
expect(
  petConsoleSource.includes("edgeTitle") && petConsoleSource.includes('line.setAttribute("aria-label"'),
  "Graph edges should keep accessible relationship labels without visible canvas text",
  failures,
);
expect(
  petConsoleSource.includes("measureMemoryGraphNode") &&
    petConsoleSource.includes("memoryGraphColumnGap") &&
    petConsoleSource.includes("memoryGraphColumnHeight"),
  "Graph layout should measure node content and compute dynamic column gaps before placing nodes",
  failures,
);
expect(
  petConsoleSource.includes("wrapGraphLabelLines") &&
    petConsoleSource.includes("appendGraphTextLines") &&
    petConsoleSource.includes("createElementNS(\"http://www.w3.org/2000/svg\", \"tspan\")"),
  "Graph node labels should wrap into SVG tspans instead of relying on fixed single-line truncation",
  failures,
);
expect(
  !petConsoleSource.includes("truncateGraphLabel("),
  "Graph renderer should not use fixed character-count truncation for node labels",
  failures,
);
expect(
  petConsoleSource.includes("badgeWidth") &&
    petConsoleSource.includes("titleMaxWidth") &&
    petConsoleSource.includes("subtitleMaxWidth"),
  "Graph node measurement should reserve space for badges and text separately",
  failures,
);
expect(
  styleBlock(".memory-graph-edge-label").includes("display: none;"),
  "Legacy edge label style should remain hidden by default",
  failures,
);
expect(
  memoryGraphSource.includes("claimText.includes(valueText)"),
  "Preference object compression should hide simple values already present in the claim text",
  failures,
);
const rustSource = fs.readFileSync("src-tauri/src/lib.rs", "utf8");
expect(
  rustSource.includes("memory_graph_should_hide_object_node") &&
    rustSource.includes("memory_graph_entity_view_node_with_role") &&
    rustSource.includes('"entityRole": entity_role'),
  "Tauri graph query should apply the same object compression and entity-role hints as the TS fallback",
  failures,
);

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
const objectNodes = view.nodes.filter((node) => node.kind === "entity" && node.entityRole === "object");
expect(
  objectNodes.length === 0,
  "Simple preference memories should not render a duplicate object concept node",
  failures,
);
expect(
  view.nodes.some((node) => node.kind === "claim" && node.label.includes("67")),
  "Simple preference memories should still render the preference claim node",
  failures,
);

if (failures.length > 0) {
  console.error(`Memory graph no-overlap validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory graph no-overlap validation passed.");

function styleBlock(selector) {
  const start = styles.indexOf(`${selector} {`);
  if (start === -1) {
    return "";
  }
  const end = styles.indexOf("\n}", start);
  return end === -1 ? styles.slice(start) : styles.slice(start, end + 2);
}
