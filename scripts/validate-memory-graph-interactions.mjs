import fs from "node:fs";

const failures = [];
const petConsole = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");

mustInclude('group.addEventListener("pointerdown"', "node pointerdown handler");
mustInclude("event.stopPropagation()", "node events stop propagation");
mustInclude('group.addEventListener("dblclick"', "node double-click expand handler");
mustInclude("expandedNodeIds", "expanded node state for one-hop neighbor expansion");
mustInclude("memory_graph_query_neighbors", "backend one-hop neighbor query");
mustInclude('svg.addEventListener("pointercancel"', "canvas pointercancel cleanup");
mustInclude('svg.addEventListener("lostpointercapture"', "canvas lostpointercapture cleanup");
mustInclude('svg.addEventListener("selectstart"', "canvas blocks native text selection");
mustInclude('svg.addEventListener("dragstart"', "canvas blocks native drag gestures");
mustInclude("clearMemoryGraphTextSelection()", "graph drag clears browser text selection");
mustInclude('svg.dataset.dragging = "true"', "graph canvas exposes active drag state");
mustInclude("svg.releasePointerCapture(pointerId)", "graph canvas releases pointer capture after drag");
mustInclude("beforeX = (cursorX - offsetX) / scale", "cursor-centered wheel zoom math");
mustInclude("closest(\".memory-graph-node\")", "canvas drag ignores graph nodes");
mustInclude("Relayout", "relayout control");
mustInclude("Fit", "fit-canvas control");
mustInclude("New fact", "new claim toolbar control");
mustInclude("New relation", "new edge toolbar control");
mustInclude("memory-graph-filter-strip", "two-part graph toolbar filter strip");
mustInclude("memory-graph-modebar", "graph governance mode segmented control");
mustInclude("memory-graph-toolbar-row", "layered graph toolbar rows");
mustInclude("memory-graph-scope-caption", "read-only selected scope caption");
mustInclude("memory-graph-controlbar", "graph filter/action control bar");
mustInclude("memory-graph-actions-inline", "compact graph toolbar action group");
mustInclude("memory-graph-detail-empty", "graph detail empty inspector state");
mustInclude("memory-graph-property-grid", "graph detail property grid");
mustInclude("memory-graph-detail-section", "graph detail property inspector sections");
mustInclude("memory-graph-node-badge", "semantic node badge");
mustInclude("memory-graph-node-marker", "semantic node marker");
mustInclude("edgeTitle", "edge accessible title");
mustInclude('line.setAttribute("aria-label"', "edge accessible label");
mustInclude("dataset.semantic", "semantic edge styling marker");
mustInclude("dataset.dimmed", "focused graph dimming state");
mustInclude("dataset.focused", "focused graph neighbor state");
mustInclude("computeDownstreamMemoryGraphFocus", "downstream graph focus helper");
mustInclude("adjacency.get(nodeId)", "downstream focus follows directed outgoing edges");
mustInclude("selectedNodeId = selectedNodeId === nodeId ? undefined : nodeId", "clicking selected graph node toggles focus off");
mustInclude("memoryGraphViewerLabel", "read-only identity-view label derived from selected memory tree node");
mustInclude("memory-graph-viewer-caption", "read-only identity-view caption");
mustInclude('return selectedScope?.scope ?? "global";', "graph query scope comes from selected memory tree node");
mustInclude("editorMode?: \"claim\" | \"edge\" | null", "graph UI state includes editor mode");
mustInclude("root.dataset.editorMode", "graph editor mode persists through local redraws");
mustInclude("if (selectedNodeId && !renderView.nodes.some((node) => node.id === selectedNodeId))", "graph redraw clears selected node ids missing from rendered view");
mustInclude('event.key === "Escape"', "Esc clears selection or closes graph editor");
mustInclude('event.key === "/"', "slash key focuses graph search");
mustInclude('event.key.toLowerCase() === "f"', "F key fits graph canvas");
mustInclude("captureMemoryGraphUiState(root)", "memory dashboard captures graph state across local refresh");

if (!styles.includes(".memory-graph-toolbar") || !styles.includes(".memory-graph-svg-wrap")) {
  failures.push("memory graph CSS should keep toolbar and SVG workspace styles");
}

mustStyleInclude("@media (max-width: 1180px)", "medium-width memory graph breakpoint");
mustStyleInclude(".console-shell--memory .console-body", "memory shell body responsive override");
mustStyleInclude('.console-content[data-view="memory"] .memory-dashboard', "memory dashboard responsive override");
mustStyleInclude("grid-template-columns: minmax(0, 1fr);", "single-column memory fallback for narrow windows");
mustStyleInclude(".memory-graph-toolbar", "memory graph toolbar responsive rules");
mustStyleInclude(".memory-graph-toolbar-row", "memory graph toolbar row styles");
mustStyleInclude(".memory-graph-scope-caption", "read-only selected scope caption styles");
mustStyleInclude(".memory-graph-modebar", "memory graph mode bar styles");
mustStyleInclude(".memory-graph-mode-tab", "memory graph mode tabs styles");
mustStyleInclude(".memory-graph-controlbar", "memory graph control bar styles");
mustStyleInclude(".memory-graph-filter-strip", "memory graph filter strip styles");
mustStyleInclude("repeat(auto-fit, minmax(128px, 1fr))", "graph filter strip wraps before overlapping actions");
mustStyleInclude(".memory-graph-actions-inline", "memory graph toolbar action group styles");
mustStyleInclude("flex-direction: column;", "graph filters and actions are stacked to prevent overlap");
mustStyleInclude("align-self: stretch;", "graph action group owns a full toolbar row instead of sharing filters");
mustStyleInclude("overflow-x: auto;", "graph action group scrolls instead of overlapping filters");
mustNotInclude("renderMemoryGraphScopePicker", "graph internal scope picker renderer");
mustNotInclude("memoryGraphScopeOptions", "graph internal scope options");
mustNotInclude("memoryGraphScopeGroups", "graph internal scope groups");
mustNotInclude("memoryGraphViewerOptions", "graph internal viewer options");
mustNotInclude('button.dataset.filter = "scope"', "graph internal scope filter button");
mustNotInclude('button.dataset.filter = "viewer"', "graph internal viewer filter button");
mustNotInclude('data-filter="viewer"', "graph internal viewer filter data attribute");
mustNotStyleInclude(".memory-graph-scope-picker", "scope picker styles");
mustNotStyleInclude(".memory-graph-scope-popover", "scope popover styles");
mustStyleInclude(".memory-graph-viewer-caption", "read-only selected viewer caption styles");
mustNotStyleBlockInclude(".memory-graph-controlbar", "grid-template-columns: minmax(0, 1fr) auto;", "graph actions must not share a two-column row with filters");
mustStyleInclude(".memory-graph-property-grid", "graph detail property grid styles");
mustStyleInclude(".memory-graph-detail-section", "graph detail section styles");
mustStyleInclude(".memory-graph-detail-content", "graph detail content block styles");
mustStyleInclude(".memory-graph-detail-empty", "graph detail empty state styles");
mustStyleInclude(".memory-graph-node-badge", "semantic node badge styles");
mustStyleInclude(".memory-graph-node-marker", "semantic node marker styles");
mustStyleInclude("touch-action: none;", "graph canvas disables browser touch drag behavior");
mustStyleInclude("-webkit-user-select: none;", "graph canvas disables browser text selection");
mustStyleInclude('.memory-graph-svg[data-dragging="true"]', "graph canvas drag cursor is controlled by drag state");
mustStyleInclude(".memory-graph-edge-label", "hidden edge label compatibility styles");
mustStyleInclude("display: none;", "edge labels are hidden by default to prevent node overlap");
mustStyleInclude('.memory-graph-edge[data-semantic="conflict"]', "conflict edge styling");
mustStyleInclude('.memory-graph-node[data-dimmed="true"]', "non-neighbor node dimming");
mustStyleInclude('.memory-graph-edge[data-dimmed="true"]', "non-neighbor edge dimming");
mustStyleInclude(".memory-graph-body", "memory graph body responsive rules");
mustStyleInclude("min-height: clamp(460px, 64vh, 820px);", "graph workspace minimum height");

if (failures.length > 0) {
  console.error(`Memory graph interaction validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory graph interaction validation passed.");

function mustInclude(marker, label) {
  if (!petConsole.includes(marker)) {
    failures.push(`Missing ${label}: ${marker}`);
  }
}

function mustNotInclude(marker, label) {
  if (petConsole.includes(marker)) {
    failures.push(`Unexpected ${label}: ${marker}`);
  }
}

function mustStyleInclude(marker, label) {
  if (!styles.includes(marker)) {
    failures.push(`Missing ${label}: ${marker}`);
  }
}

function mustNotStyleInclude(marker, label) {
  if (styles.includes(marker)) {
    failures.push(`Unexpected ${label}: ${marker}`);
  }
}

function mustNotStyleBlockInclude(selector, marker, label) {
  const start = styles.indexOf(`${selector} {`);
  if (start === -1) {
    failures.push(`Missing style block for ${selector}`);
    return;
  }
  const end = styles.indexOf("\n}", start);
  const block = end === -1 ? styles.slice(start) : styles.slice(start, end + 2);
  if (block.includes(marker)) {
    failures.push(`Unexpected ${label} in ${selector}: ${marker}`);
  }
}
