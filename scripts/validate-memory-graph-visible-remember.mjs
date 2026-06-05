import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { expect, loadMemoryGraphModule } from "./memory-graph-validation-loader.mjs";

const failures = [];

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-visible-remember-validation-"));
const compilerOptions = {
  module: ts.ModuleKind.ES2022,
  target: ts.ScriptTarget.ES2022,
  importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
};
const graphSource = fs
  .readFileSync("src/core/memoryGraph.ts", "utf8")
  .replace(
    'import { invoke } from "@tauri-apps/api/core";',
    'const invoke = async () => { throw new Error("Tauri invoke is unavailable in visible remember validation."); };',
  );
const extractionSource = fs.readFileSync("src/core/memoryExtractionPipeline.ts", "utf8");
const memorySource = fs.readFileSync("src/core/memory.ts", "utf8");
fs.writeFileSync(path.join(tempDir, "memoryGraph.mjs"), ts.transpileModule(graphSource, { compilerOptions }).outputText);
fs.writeFileSync(path.join(tempDir, "memoryExtractionPipeline.mjs"), ts.transpileModule(extractionSource, { compilerOptions }).outputText);
fs.writeFileSync(
  path.join(tempDir, "memory.mjs"),
  ts
    .transpileModule(memorySource, { compilerOptions })
    .outputText
    .replaceAll("./memoryGraph", "./memoryGraph.mjs")
    .replaceAll("./memoryExtractionPipeline", "./memoryExtractionPipeline.mjs"),
);

const { MemoryStore } = await import(pathToFileURL(path.join(tempDir, "memory.mjs")).href);
const { InMemoryMemoryGraphRepository } = await loadMemoryGraphModule();

const scope = "character:demo";
const store = new MemoryStore();
const result = store.recordMemoryEvent({
  kind: "mention",
  memorySavingEnabled: true,
  scope,
  text: "记住我喜欢67",
  source: "user",
  now: new Date("2026-05-29T08:00:00.000Z"),
});

expect(result.saved === true, "explicit remember should save through recordMemoryEvent", failures);
const longTerm = store.listCompressedMemories(scope);
expect(longTerm.some((entry) => entry.text.includes("67")), "list view long-term memory should include 67", failures);

const graphInputs = store.listGraphClaimInputs(scope);
const preferenceClaim = graphInputs.find((claim) => claim.text.includes("67"));
expect(Boolean(preferenceClaim), "listGraphClaimInputs should expose the visible 67 memory to graph sync", failures);
expect(preferenceClaim?.kind === "preference", "remember preference should become a preference graph claim", failures);
expect(preferenceClaim?.visibility === "private_character", "one-on-one remember preference should be private_character", failures);
expect(preferenceClaim?.status === "needs_review", "one-on-one remember preference should wait for confirmation", failures);
expect(preferenceClaim?.text === "用户偏好：67。", `one-on-one remember preference should use clean extracted text, got ${preferenceClaim?.text ?? "<none>"}`, failures);
expect((preferenceClaim?.confidence ?? 0) >= 0.9, "explicit remember preference should have high confidence", failures);
expect(graphInputs.filter((claim) => claim.text.includes("67")).length === 1, "graph sync should export the 67 preference once", failures);

store.confirmCandidate(longTerm.find((entry) => entry.text.includes("67"))?.id ?? "");
const confirmedClaim = store.listGraphClaimInputs(scope).find((claim) => claim.text.includes("67"));
expect(confirmedClaim?.status === "active", "confirmed remember preference should become active", failures);

const repo = new InMemoryMemoryGraphRepository();
for (const claim of store.listGraphClaimInputs(scope)) {
  repo.mergeClaimSync(claim);
}

const browseView = repo.queryGraphViewSync({
  scope,
  viewer: { type: "one_on_one", packId: "demo" },
  mode: "browse",
  maxNodes: 120,
});
expect(viewHasClaim(browseView, confirmedClaim?.id), "browse graph should show the 67 preference relationship", failures);
expect((browseView.visibleClaimCount ?? 0) >= 1, "browse graph should report visible claim count", failures);
expect((browseView.modeClaimCount ?? 0) >= 1, "browse graph should report mode claim count", failures);

const visibilityView = repo.queryGraphViewSync({
  scope,
  viewer: { type: "one_on_one", packId: "demo" },
  mode: "visibility",
  maxNodes: 120,
});
expect(
  !viewHasClaim(visibilityView, confirmedClaim?.id),
  "visibility governance mode should not display normal private_character preference claims",
  failures,
);
expect((visibilityView.visibleClaimCount ?? 0) >= 1, "visibility governance mode should still report normal visible memory count", failures);
expect((visibilityView.modeClaimCount ?? 0) === 0, "visibility governance mode should report zero displayed claims when no visibility issue exists", failures);

const mainSource = fs.readFileSync("src/main.ts", "utf8");
expect(mainSource.includes("graphReplace"), "memory persistence should distinguish graph merge from graph replace", failures);
expect(
  !/await memoryGraphRepository\.deleteScope\(scope\);\s*for \(const claim of memoryStore\.listGraphClaimInputs\(scope\)\)/s.test(mainSource),
  "normal graph sync should not delete each scope before merging claims",
  failures,
);

const petConsoleSource = fs.readFileSync("src/ui/petConsole.ts", "utf8");
expect(
  petConsoleSource.includes("graphClaims: MemoryGraphClaim[]"),
  "Memory dashboard scope should carry graph claims so list and graph share the same visible facts",
  failures,
);
expect(
  petConsoleSource.includes('sourceType: "compressed" | "graph"'),
  "Memory dashboard facts should be able to render graph-only claims without pretending they are legacy memories",
  failures,
);
expect(
  /for \(const claim of scope\.graphClaims\)/.test(petConsoleSource),
  "Memory dashboard list should merge scope.graphClaims into visible facts",
  failures,
);
expect(
  /graphClaims:\s*memoryStore\.listGraphClaimsForViewer\(/.test(petConsoleSource),
  "Memory dashboard scope builders should read viewer-aware graph claims from MemoryStore",
  failures,
);
expect(
  petConsoleSource.includes("memoryDashboardFactDedupeKey"),
  "Memory dashboard graph/list merge should dedupe legacy and graph variants",
  failures,
);
expect(
  petConsoleSource.includes("normalizeMemoryFactDedupeKey"),
  "Memory dashboard should reuse the core memory fact dedupe key instead of a separate UI-only key",
  failures,
);
expect(
  /persistentDedupeKeys\.has\(key\)/.test(petConsoleSource),
  "Memory dashboard short-term entries should be hidden when a persistent long-term or graph fact already covers the same memory",
  failures,
);
expect(
  /for \(const memory of scope\.longTerm\)[\s\S]*?persistentDedupeKeys\.has\(key\)[\s\S]*?continue;/.test(petConsoleSource),
  "Memory dashboard should hide duplicate existing long-term memories that normalize to the same fact",
  failures,
);

const rustSource = fs.readFileSync("src-tauri/src/lib.rs", "utf8");
expect(rustSource.includes('memory_graph_json_optional_string(viewer, "packId")'), "SQLite graph query should read one-on-one packId", failures);
expect(
  rustSource.includes("c.scope = ('character:' || ?8) AND c.visibility = 'private_character'"),
  "SQLite graph query should allow one-on-one private_character claims for the selected pack",
  failures,
);

if (failures.length > 0) {
  console.error(`Visible remember graph validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Visible remember graph validation passed.");

function viewHasClaim(view, claimId) {
  return Boolean(claimId) && (view.nodes.some((node) => node.sourceClaimId === claimId) || view.edges.some((edge) => edge.sourceClaimId === claimId));
}
