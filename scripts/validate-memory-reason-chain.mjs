import fs from "node:fs";

const graphSource = fs.readFileSync("src/core/memoryGraph.ts", "utf8");
const extractionSource = fs.readFileSync("src/core/memoryExtractionPipeline.ts", "utf8");
const uiSource = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const failures = [];

expect(graphSource.includes("export interface MemoryGraphReasonChainStep"), "memory graph should define reason chain steps");
expect(graphSource.includes("reasonChain?: MemoryGraphReasonChainStep[]"), "claims and view nodes should carry reason chains");
expect(graphSource.includes("normalizeMemoryGraphReasonChain"), "memory graph should normalize reason chain inputs");
expect(extractionSource.includes("reasonChainForAtom"), "extraction pipeline should create reason chains for generated claims");
expect(extractionSource.includes("relationshipTypeForAtom"), "extraction pipeline should map observations to perspective relationship types");
expect(uiSource.includes("memory-graph-reason-chain"), "Memory UI should render reason chains");
expect(uiSource.includes('memoryGraphText(language, "reasonChain", "Reason chain")'), "detail panel should label reason chain section");

if (failures.length > 0) {
  console.error(`validate-memory-reason-chain failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-memory-reason-chain passed");

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
