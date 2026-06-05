import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const version = process.env.CASTROOM_RELEASE_VERSION ?? "v0.1.0-test";
const assetStamp = process.env.CASTROOM_RELEASE_ASSET_STAMP ?? "2026-06-05";
const outDir = path.join(root, "artifacts", "github-release", version);

const requiredFiles = [
  `CastRoom-AI_${assetStamp}_windows-portable.zip`,
  "SHA256SUMS.txt",
  "RELEASE_NOTES.md",
];
const optionalAssetFiles = [
  `CastRoom-AI_${assetStamp}_x64-setup.exe`,
  `CastRoom-AI_${assetStamp}_x64_en-US.msi`,
];

function fail(message) {
  console.error(`GitHub release asset validation failed: ${message}`);
  process.exit(1);
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

if (!fs.existsSync(outDir)) {
  fail(`release asset directory does not exist: ${outDir}`);
}

for (const file of requiredFiles) {
  const filePath = path.join(outDir, file);
  if (!fs.existsSync(filePath)) {
    fail(`missing required release file: ${file}`);
  }
  if (file.endsWith(".exe") || file.endsWith(".msi") || file.endsWith(".zip")) {
    const size = fs.statSync(filePath).size;
    if (size < 100 * 1024 * 1024) {
      fail(`release asset is unexpectedly small: ${file}`);
    }
  }
}

for (const file of fs.readdirSync(outDir)) {
  if (/CastRoom-AI_0\.1\.0_.*\.(zip|exe|msi)$/i.test(file)) {
    fail(`old 0.1.0 release asset must not be present: ${file}`);
  }
}

const sums = fs.readFileSync(path.join(outDir, "SHA256SUMS.txt"), "utf8").trim().split(/\r?\n/);
const expected = new Map();
for (const line of sums) {
  const match = /^([a-f0-9]{64})\s{2}(.+)$/.exec(line);
  if (!match) {
    fail(`invalid SHA256SUMS line: ${line}`);
  }
  expected.set(match[2], match[1]);
}

const assetFiles = [
  ...requiredFiles.filter((file) => file.endsWith(".exe") || file.endsWith(".msi") || file.endsWith(".zip")),
  ...optionalAssetFiles.filter((file) => fs.existsSync(path.join(outDir, file))),
];

for (const file of assetFiles) {
  const expectedHash = expected.get(file);
  if (!expectedHash) {
    fail(`missing checksum entry for ${file}`);
  }
  const actualHash = sha256(path.join(outDir, file));
  if (actualHash !== expectedHash) {
    fail(`checksum mismatch for ${file}`);
  }
}

const portableZip = path.join(outDir, `CastRoom-AI_${assetStamp}_windows-portable.zip`);
const portableEntries = new Set(
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "& { param($zipPath) Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath); try { $zip.Entries | ForEach-Object { $_.FullName } } finally { $zip.Dispose() } }",
      portableZip,
    ],
    { encoding: "utf8" },
  )
    .trim()
    .split(/\r?\n/)
    .map((entry) => entry.replaceAll("\\", "/"))
    .filter(Boolean),
);

for (const entry of [
  "CastRoom AI/CastRoom AI.exe",
  "CastRoom AI/README_TESTERS.txt",
  "CastRoom AI/LICENSE",
  "CastRoom AI/character-packs/README.md",
  "CastRoom AI/resources/models/chat/qwen3-0.6b-q8_0/manifest.json",
  "CastRoom AI/resources/runners/llama.cpp/llama-cli.exe",
]) {
  if (!portableEntries.has(entry)) {
    fail(`portable zip missing required entry: ${entry}`);
  }
}

for (const entry of portableEntries) {
  if (
    /(^|\/)\.env($|\/)/.test(entry) ||
    /(^|\/)runtime-data(\/|$)/.test(entry) ||
    /(^|\/)node_modules(\/|$)/.test(entry) ||
    /(^|\/)src-tauri\/target(\/|$)/.test(entry) ||
    /\.(log|key|pem|p12|pfx)$/i.test(entry)
  ) {
    fail(`portable zip contains forbidden entry: ${entry}`);
  }
}

const notes = fs.readFileSync(path.join(outDir, "RELEASE_NOTES.md"), "utf8");
for (const required of ["early Windows test build", "portable zip", "configure their own AI provider", "Checksums"]) {
  if (!notes.includes(required)) {
    fail(`release notes missing required text: ${required}`);
  }
}

console.log(`GitHub release asset validation passed: ${outDir}`);
