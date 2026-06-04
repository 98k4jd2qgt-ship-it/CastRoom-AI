import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const renderGate = fs.readFileSync("src/core/renderGate.ts", "utf8");
const petConsole = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const failures = [];

mustInclude(renderGate, "export type RenderWorkspace", "RenderGate workspace type");
mustInclude(renderGate, "workspace?: RenderWorkspace", "RenderGate request workspace field");
mustInclude(renderGate, "localUpdate?: () => boolean", "RenderGate local update callback");
mustInclude(renderGate, "const localUpdated = input.localUpdate?.() === true", "RenderGate executes local updates before full render");

mustInclude(main, "function resolveRenderWorkspace(", "main resolves current render workspace");
mustInclude(main, "return \"console_memory\";", "memory workspace classification");
mustInclude(main, "function createRenderLocalUpdate(", "main creates local update callbacks");
mustInclude(main, "if (workspace === \"console_memory\")", "memory workspace uses local update");
mustInclude(main, "return notifyMemoryDashboardUpdated;", "memory local update dispatches panel event");

const requestRenderBlock = sliceFunction(main, "requestRender");
mustInclude(requestRenderBlock, "workspace,", "requestRender passes workspace into RenderGate");
mustInclude(requestRenderBlock, "localUpdate: createRenderLocalUpdate", "requestRender passes local update into RenderGate");
mustInclude(requestRenderBlock, "localUpdated: decision.localUpdated", "suppressed render diagnostics include local update");

const refreshAfterMemoryActionBlock = sliceFunction(main, "refreshAfterMemoryAction");
mustInclude(refreshAfterMemoryActionBlock, "notifyMemoryDashboardUpdated()", "memory actions prefer local panel refresh");
mustInclude(refreshAfterMemoryActionBlock, "requestRender(reason, { kind: \"status\" })", "memory actions retain non-memory fallback");

mustInclude(petConsole, "castroom-memory-store-updated", "memory panel listens for local update event");
mustInclude(petConsole, "captureMemoryGraphUiState(root)", "memory refresh captures graph state before redraw");
mustInclude(petConsole, "editorMode?: \"claim\" | \"edge\" | null", "graph UI state preserves editor mode");
mustInclude(petConsole, "root.dataset.editorMode", "graph editor mode is stored in DOM dataset");
mustInclude(petConsole, "if (selectedNodeId && !view.nodes.some((node) => node.id === selectedNodeId))", "graph redraw clears stale selected node ids without replacing the current selection");

if (failures.length) {
  console.error(`Memory no-full-render validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory no-full-render validation passed.");

function sliceFunction(text, name) {
  const start = text.indexOf(`function ${name}`);
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const next = text.indexOf("\nfunction ", start + 1);
  return next < 0 ? text.slice(start) : text.slice(start, next);
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}
