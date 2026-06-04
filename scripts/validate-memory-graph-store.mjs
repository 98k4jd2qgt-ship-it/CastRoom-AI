import fs from "node:fs";

const failures = [];

const rust = read("src-tauri/src/lib.rs");
const cargo = read("src-tauri/Cargo.toml");
const graph = read("src/core/memoryGraph.ts");
const memory = read("src/core/memory.ts");
const main = read("src/main.ts");

for (const marker of [
  'rusqlite = { version = "0.31", features = ["bundled"] }',
]) {
  mustInclude(cargo, marker, `Cargo dependency ${marker}`);
}

for (const table of [
  "CREATE TABLE IF NOT EXISTS schema_meta",
  "CREATE TABLE IF NOT EXISTS memory_nodes",
  "CREATE TABLE IF NOT EXISTS memory_claims",
  "CREATE TABLE IF NOT EXISTS memory_edges",
  "CREATE TABLE IF NOT EXISTS memory_sources",
  "CREATE TABLE IF NOT EXISTS memory_visibility",
  "CREATE TABLE IF NOT EXISTS memory_versions",
  "idx_memory_claims_confidence",
  "idx_memory_visibility_role",
]) {
  mustInclude(rust, table, `SQLite schema marker ${table}`);
}

for (const command of [
  "memory_graph_migrate",
  "memory_graph_upsert_node",
  "memory_graph_merge_claim",
  "memory_graph_query_visible_claims",
  "memory_graph_query_view",
  "memory_graph_query_neighbors",
  "memory_graph_update_claim",
  "memory_graph_archive_claim",
  "memory_graph_delete_claim",
  "memory_graph_create_edge",
  "memory_graph_delete_edge",
  "memory_graph_resolve_conflict",
  "memory_graph_delete_scope",
  "memory_graph_export_neo4j",
]) {
  mustInclude(rust, command, `Tauri command ${command}`);
}

for (const marker of [
  "export interface MemoryGraphRepository",
  "export class InMemoryMemoryGraphRepository",
  "export class TauriSQLiteMemoryGraphRepository",
  "memoryGraphClaimFromCompressedEntry",
  "MemoryGraphQueryContext",
]) {
  mustInclude(graph, marker, `memory graph API ${marker}`);
}

mustInclude(memory, "private readonly graph = new InMemoryMemoryGraphRepository()", "MemoryStore graph facade");
mustInclude(memory, "syncCompressedMemoryToGraph", "MemoryStore graph sync");
mustInclude(memory, "listGraphClaimInputs", "MemoryStore graph claim input export");
mustInclude(memory, "queryVisibleClaimsSync", "prompt reads graph claims");
mustInclude(main, "new TauriSQLiteMemoryGraphRepository()", "runtime SQLite memory graph repository");
mustInclude(main, "persistProjectRuntimeMemoryGraphScopes", "runtime SQLite memory graph persistence");
mustInclude(main, "memoryGraphRepository.mergeClaim(claim)", "runtime memory graph claim dual write");
mustInclude(main, "memoryGraphRepository.deleteScope(scope)", "runtime memory graph scope rewrite");

if (failures.length > 0) {
  console.error(`Memory graph store validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory graph store validation passed.");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`Missing ${label}`);
  }
}
