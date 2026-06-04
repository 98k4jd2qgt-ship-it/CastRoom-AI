import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inventoryPath = path.join(root, "docs", "license-inventory.md");
const failures = [];
const warnings = [];

if (!fs.existsSync(inventoryPath)) {
  failures.push("Missing docs/license-inventory.md. Run npm.cmd run licenses.");
} else {
  const text = fs.readFileSync(inventoryPath, "utf8");
  for (const marker of ["CastRoom AI", "NPM", "Rust / Cargo"]) {
    if (!text.includes(marker)) {
      failures.push(`License inventory is missing marker: ${marker}`);
    }
  }

  const rows = parseMarkdownRows(text);
  const unknownRuntimeRows = rows.filter((row) => {
    const license = row.License?.toLowerCase();
    const type = row.Type?.toLowerCase();
    const source = row.Source?.toLowerCase();
    return license === "unknown" && (type === "runtime" || source === "registry");
  });
  const unknownDevRows = rows.filter((row) => row.License?.toLowerCase() === "unknown" && row.Type?.toLowerCase() === "dev");

  if (unknownRuntimeRows.length > 0) {
    failures.push(
      `Release/runtime license entries must not be unknown:\n${unknownRuntimeRows
        .slice(0, 20)
        .map((row) => `  - ${row.Package || row.Crate} ${row.Version}`)
        .join("\n")}${unknownRuntimeRows.length > 20 ? `\n  ...and ${unknownRuntimeRows.length - 20} more` : ""}`,
    );
  }
  if (unknownDevRows.length > 0) {
    warnings.push(`${unknownDevRows.length} dev dependency license entries are unknown; release/runtime entries are the hard gate.`);
  }
}

if (warnings.length > 0) {
  console.warn(`License inventory warnings:\n${warnings.map((item) => `- ${item}`).join("\n")}`);
}

if (failures.length > 0) {
  console.error(`License inventory completeness validation failed:\n${failures.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

console.log("License inventory completeness validation passed");

function parseMarkdownRows(text) {
  const rows = [];
  let currentHeaders = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("|") || !line.endsWith("|")) {
      continue;
    }
    const cells = line
      .slice(1, -1)
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim().replaceAll("\\|", "|"));
    if (cells.every((cell) => /^-+$/.test(cell))) {
      continue;
    }
    if (cells.includes("License")) {
      currentHeaders = cells;
      continue;
    }
    if (!currentHeaders || cells.length !== currentHeaders.length) {
      continue;
    }
    const row = {};
    currentHeaders.forEach((header, index) => {
      row[header] = cells[index];
    });
    rows.push(row);
  }
  return rows;
}
