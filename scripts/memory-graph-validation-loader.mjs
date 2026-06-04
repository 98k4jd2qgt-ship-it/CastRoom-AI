import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export async function loadMemoryGraphModule() {
  const source = fs
    .readFileSync("src/core/memoryGraph.ts", "utf8")
    .replace(
      'import { invoke } from "@tauri-apps/api/core";',
      'const invoke = async () => { throw new Error("Tauri invoke is unavailable in memory graph validation."); };',
    );
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-memory-graph-validation-"));
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  const modulePath = path.join(tempDir, "memoryGraph.mjs");
  fs.writeFileSync(modulePath, js);
  return import(pathToFileURL(modulePath).href);
}

export function expect(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}
