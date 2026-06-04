import fs from "node:fs";

const failures = [];
const petConsole = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");

for (const marker of [
  "getMemoryGraphModeContext",
  "root.dataset.mode = graphState.mode",
  "renderMemoryGraphModeBar(graphState.mode",
  "syncMemoryGraphModeBar(modeBar, graphState.mode)",
  "function syncMemoryGraphModeBar",
  "button.dataset.mode",
  'button.setAttribute("aria-selected", String(active))',
  'button.classList.toggle("is-active", active)',
  "renderMemoryGraphGovernanceSummary(view, graphState.mode",
  "selectedNodeId = undefined",
  "graphState.selectedNodeId = undefined",
]) {
  expect(petConsole.includes(marker), `Memory graph mode sync source should include ${marker}`);
}

expect(
  countOccurrences(petConsole, "getMemoryGraphModeContext(") >= 3,
  "Graph mode context should be reused by governance summary, canvas empty state, and detail empty state",
);

expect(
  petConsole.includes("if (selectedNodeId && !renderView.nodes.some((node) => node.id === selectedNodeId))"),
  "Graph redraw should clear stale selectedNodeId missing from the actual rendered view",
);

expect(
  petConsole.includes("Switch to Browse") &&
    petConsole.includes("visibleClaimCount") &&
    petConsole.includes("modeClaimCount"),
  "Governance empty state should explain that normal memories are hidden by issue-only modes",
);

expect(
  styleBlock(".memory-graph-governance-link").includes("background: transparent;") &&
    styleBlock(".memory-graph-governance-link").includes("border: 0;") &&
    styleBlock(".memory-graph-governance-link").includes("width: fit-content;"),
  "Governance browse link must be themed and must not render as a default white button bar",
);

expect(
  styleBlock(".memory-graph-empty-state").includes("background: transparent;") ||
    styleBlock(".memory-graph-empty-state").includes("background: none;"),
  "Graph empty state should inherit the dark workspace theme",
);

if (failures.length > 0) {
  console.error(`Memory graph mode sync validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory graph mode sync validation passed.");

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function countOccurrences(source, pattern) {
  return source.split(pattern).length - 1;
}

function styleBlock(selector) {
  const start = styles.indexOf(`${selector} {`);
  if (start === -1) {
    return "";
  }
  const end = styles.indexOf("\n}", start);
  return end === -1 ? styles.slice(start) : styles.slice(start, end + 2);
}
