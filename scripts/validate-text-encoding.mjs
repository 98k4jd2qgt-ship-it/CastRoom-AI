import fs from "node:fs";

const files = [
  "src/core/ai.ts",
  "src/core/commands.ts",
  "src/core/roomScheduler.ts",
  "src/ui/copy.ts",
  "src/ui/petConsole.ts",
  "src/ui/roomSurface.ts",
  "src-tauri/src/lib.rs",
];

const mojibakePattern = /[\u00e6\u00e8\u00e5\u00e3\u00c2\u00c3\ufffd]/;
const failures = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (mojibakePattern.test(line)) {
      failures.push(`${file}:${index + 1} contains likely mojibake: ${line.trim().slice(0, 160)}`);
    }
  });
}

if (failures.length > 0) {
  console.error(`Text encoding validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Text encoding validation passed");
