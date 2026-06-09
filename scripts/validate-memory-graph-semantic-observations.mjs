import fs from "node:fs";
import { expect } from "./memory-graph-validation-loader.mjs";

const failures = [];
const petConsoleSource = fs.readFileSync("src/ui/petConsole.ts", "utf8");

for (const marker of [
  "function buildSemanticObservationGraphView",
  "scope.semanticObservations",
  "semantic-group:",
  "semantic-observation:",
  "semanticObservationClaimKind",
  "semanticObservationGraphEpistemicStatus",
  "semanticObservationMatchesGraphFilters",
]) {
  expect(petConsoleSource.includes(marker), `Memory graph must include semantic observation graph marker ${marker}`, failures);
}

expect(
  /const semanticView = selectedScope\s*\?\s*buildSemanticObservationGraphView\(selectedScope, graphState, language\)/s.test(petConsoleSource),
  "fallback graph view must merge semantic observations for the selected scope",
  failures,
);

expect(
  petConsoleSource.includes("mergeMemoryGraphViews([...claimViews, semanticView])"),
  "fallback graph view must merge graph claims with semantic observation graph view",
  failures,
);

expect(
  petConsoleSource.includes('nodeId.startsWith("semantic-group:")'),
  "semantic category groups must be expandable through expandedNodeIds",
  failures,
);

expect(
  petConsoleSource.includes('node.id.startsWith("semantic-group:")') && petConsoleSource.includes("return false;"),
  "semantic expandable graph must not be regrouped by legacy claim grouping",
  failures,
);

expect(
  petConsoleSource.includes('status === "inferred" ? "observed"'),
  "semantic inferred observations must render as observed truth without pretending to be confirmed",
  failures,
);

expect(
  petConsoleSource.includes("MEMORY_GRAPH_GROUP_EXPANDED_LIMIT") && petConsoleSource.includes("expanded.has(entry.group.id)"),
  "semantic observation details must only render when their category group is expanded",
  failures,
);

expect(
  petConsoleSource.includes("semanticObservationVisibility(observation)") && petConsoleSource.includes("graphState.visibility"),
  "semantic graph filtering must preserve visibility filtering",
  failures,
);

expect(
  !/nodes\.set\(observationNode\.id,\s*observationNode\)[\s\S]{0,240}if \(!expanded\.has/.test(petConsoleSource),
  "semantic observation detail nodes must not be inserted before the group expansion guard",
  failures,
);

if (failures.length > 0) {
  console.error(`Memory graph semantic observation validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory graph semantic observation validation passed.");
