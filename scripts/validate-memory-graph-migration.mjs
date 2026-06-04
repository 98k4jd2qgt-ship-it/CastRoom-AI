import fs from "node:fs";

const failures = [];

const rust = fs.readFileSync("src-tauri/src/lib.rs", "utf8");
const graph = fs.readFileSync("src/core/memoryGraph.ts", "utf8");
const memory = fs.readFileSync("src/core/memory.ts", "utf8");

mustInclude(rust, "memory_graph_schema_version", "schema version meta");
mustInclude(rust, "migrate_memory_graph", "Rust migration helper");
mustInclude(rust, "INSERT OR IGNORE INTO schema_meta(key, value) VALUES('created_at'", "created_at meta insert");
mustInclude(rust, "ON CONFLICT(scope, canonical_key, visibility)", "claim merge unique conflict");
mustInclude(graph, "memoryGraphClaimFromCompressedEntry", "legacy compressed entry conversion");
mustInclude(memory, "restoreScope", "legacy scope restore remains available");
mustInclude(memory, "syncCompressedMemoryToGraph(normalized)", "legacy restore dual-write into graph");
mustInclude(memory, "candidateFromCompressedEntry", "legacy candidate compatibility remains available");

if (failures.length > 0) {
  console.error(`Memory graph migration validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory graph migration validation passed.");

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`Missing ${label}`);
  }
}
