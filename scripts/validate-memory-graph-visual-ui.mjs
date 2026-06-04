import fs from "node:fs";

const failures = [];
const petConsole = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");

for (const marker of [
  "renderMemoryGraphModeBar",
  "memory-graph-modebar",
  "memory-graph-toolbar-row",
  "memory-graph-scope-caption",
  "memory-graph-viewer-caption",
  "memory-graph-controlbar",
  "memory-graph-detail-heading",
  "memory-graph-detail-badges",
  "memoryGraphDetailSection",
  "memoryGraphDetailBadge",
  'memoryGraphText(language, "permissions"',
  'memoryGraphText(language, "evidence"',
  "focusedNodeIds",
  "focusedEdgeIds",
  "memory-graph-node-marker",
  "measureMemoryGraphNode",
  "wrapGraphLabelLines",
  "appendGraphTextLines",
  "edgeTitle",
  'line.setAttribute("aria-label"',
  "dataset.dimmed",
  "dataset.focused",
]) {
  expect(petConsole.includes(marker), `Graph UI source should include ${marker}`);
}

for (const marker of [
  ".memory-graph-modebar",
  ".memory-graph-mode-tab",
  ".memory-graph-toolbar-row",
  ".memory-graph-scope-caption",
  ".memory-graph-viewer-caption",
  ".memory-graph-controlbar",
  ".memory-graph-actions-inline",
  "grid-template-columns: minmax(0, 1fr);",
  "grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));",
  "max-width: 100%;",
  "align-self: stretch;",
  "writing-mode: horizontal-tb;",
  ".memory-graph-edge-label",
  '.memory-graph-edge[data-focused="true"]',
  '.memory-graph-edge[data-dimmed="true"]',
  '.memory-graph-node[data-dimmed="true"]',
  ".memory-graph-node-marker",
  ".memory-graph-detail-heading",
  ".memory-graph-detail-badges",
  ".memory-graph-detail-badge",
  ".memory-graph-detail-content",
  ".memory-graph-detail-section-title",
  '.memory-graph-detail-section[data-variant="actions"]',
  "grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);",
  "grid-template-rows: minmax(380px, 1fr) minmax(220px, auto);",
  "filter: none;",
  ".memory-scope-item.memory-tree-item[data-active=\"true\"][data-has-children=\"false\"]::before",
]) {
  expect(styles.includes(marker), `Graph visual CSS should include ${marker}`);
}

expect(!petConsole.includes("memory-summary-bar"), "Memory page should not render the old top summary pill bar.");
expect(!styles.includes(".memory-summary-bar"), "Memory graph styles should not keep unused top summary pill bar rules.");

expect(
  styleBlock(".memory-view-switch").includes("background: transparent;") &&
    styleBlock(".memory-view-switch").includes("border-radius: 0;") &&
    styleBlock(".memory-view-switch button[data-active=\"true\"]").includes("border-bottom-color: #7ee7b7;"),
  "Memory view switch should use compact underline tabs instead of capsule cards",
);

expect(
  styleBlock(".memory-graph-mode-tab").includes("background: transparent;") &&
    styleBlock(".memory-graph-mode-tab").includes("border-bottom: 2px solid transparent;") &&
    styleBlock(".memory-graph-mode-tab[data-active=\"true\"]").includes("background: transparent;") &&
    styleBlock(".memory-graph-mode-tab[data-active=\"true\"]").includes("border-bottom-color: #7ee7b7;"),
  "Graph mode tabs should be text tabs, not filled capsule buttons",
);

expect(
  styleBlock(".memory-graph-body").includes("border-radius: 0;"),
  "Graph work area should use a shared workspace boundary without card-like rounding",
);

expect(
  styleBlock(".memory-scope-item.memory-tree-item").includes("border: 0;") &&
    styleBlock(".memory-scope-item.memory-tree-item").includes("border-radius: 0;") &&
    styleBlock(".memory-scope-item.memory-tree-item[data-active=\"true\"][data-has-children=\"false\"]").includes("background: rgba(126, 231, 183, 0.045);"),
  "Memory tree rows should look like file-tree rows instead of card buttons",
);

expect(
  styleBlock(".memory-scope-item.memory-tree-item[data-active=\"true\"][data-has-children=\"false\"]::before").includes("width: 2px;"),
  "Active memory tree leaves should use a slim left active line",
);

expect(
  !styles.includes("drop-shadow(0 8px 14px"),
  "Graph nodes should avoid heavy card-like shadows",
);

expect(
  styleBlock(".memory-graph-edge-label").includes("display: none;"),
  "Graph edge labels should be hidden by default so relationship text cannot overlap nodes",
);

expect(
  !styles.includes("writing-mode: vertical"),
  "Graph toolbar/actions must not force vertical text writing",
);

expect(
  !petConsole.includes("renderMemoryGraphScopePicker") &&
    !petConsole.includes("memoryGraphScopeOptions") &&
    !petConsole.includes("memoryGraphScopeGroups"),
  "Graph UI must not render or build an internal scope picker",
);

expect(
  !petConsole.includes('button.dataset.filter = "scope"') &&
    !petConsole.includes('data-filter="scope"'),
  "Graph toolbar must not expose an internal scope filter",
);

expect(
  petConsole.includes("memoryGraphViewerLabel") &&
    petConsole.includes("memory-graph-viewer-caption") &&
    !petConsole.includes("memoryGraphViewerOptions") &&
    !petConsole.includes('button.dataset.filter = "viewer"') &&
    !petConsole.includes('data-filter="viewer"'),
  "Graph toolbar must show a read-only viewer caption derived from the selected memory tree node instead of an internal viewer selector",
);

expect(
  !styles.includes(".memory-graph-scope-picker") &&
    !styles.includes(".memory-graph-scope-popover"),
  "Graph CSS must not include internal scope picker styles",
);

expect(
  petConsole.includes('return selectedScope?.scope ?? "global";'),
  "Graph query scope should come only from the selected memory tree node",
);

expect(
  styleBlock(".memory-graph-controlbar").includes("flex-direction: column;"),
  "Graph toolbar filters and actions should be stacked to prevent overlap",
);

expect(
  !styleBlock(".memory-graph-controlbar").includes("grid-template-columns: minmax(0, 1fr) auto;"),
  "Graph action buttons must not share a grid row with filters because they can overlap",
);

expect(
  styles.includes("@media (max-width: 1180px)") && styles.includes("@media (max-width: 560px)"),
  "Graph visual CSS should keep medium and narrow responsive breakpoints",
);

if (failures.length > 0) {
  console.error(`Memory graph visual UI validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory graph visual UI validation passed.");

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function styleBlock(selector) {
  const start = styles.indexOf(`${selector} {`);
  if (start === -1) {
    return "";
  }
  const end = styles.indexOf("\n}", start);
  return end === -1 ? styles.slice(start) : styles.slice(start, end + 2);
}
