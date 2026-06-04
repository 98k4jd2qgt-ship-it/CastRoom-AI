import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const source = fs.readFileSync("src/core/memory.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
  },
}).outputText;

const { cleanCorruptedRoomMemoryData } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

const root = path.join("runtime-data", "memory", "rooms");
const files = collectJsonFiles(root);
let changedFiles = 0;
let removedItems = 0;

for (const file of files) {
  const raw = fs.readFileSync(file, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.warn(`Skipped invalid JSON: ${file}`);
    continue;
  }

  const before = countPrivateMemoryItems(data);
  const cleaned = cleanCorruptedRoomMemoryData(data);
  const after = countPrivateMemoryItems(cleaned);
  const next = `${JSON.stringify(cleaned, null, 2)}\n`;

  if (next !== raw) {
    fs.writeFileSync(file, next, "utf8");
    changedFiles += 1;
    removedItems += Math.max(0, before - after);
  }
}

console.log(`Memory artifact cleanup complete. changedFiles=${changedFiles} removedItems=${removedItems}`);

function collectJsonFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...collectJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      output.push(fullPath);
    }
  }
  return output;
}

function countPrivateMemoryItems(data) {
  return (
    (Array.isArray(data.mentions) ? data.mentions.length : 0) +
    (Array.isArray(data.compressedMemories) ? data.compressedMemories.length : 0) +
    (Array.isArray(data.candidates) ? data.candidates.length : 0) +
    (Array.isArray(data.rollingSummaries) ? data.rollingSummaries.length : 0)
  );
}
