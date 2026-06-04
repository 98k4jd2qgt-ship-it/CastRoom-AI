import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const version = process.env.CASTROOM_RELEASE_VERSION ?? "v0.1.0-test";
const outDir = path.join(root, "artifacts", "github-release", version);
const portableStageDir = path.join(outDir, "portable-stage");
const portableAppDir = path.join(portableStageDir, "CastRoom AI");
const portableZipName = "CastRoom-AI_0.1.0_windows-portable.zip";
const portableZipPath = path.join(outDir, portableZipName);

const assets = [
  {
    label: "Windows NSIS installer",
    source: path.join(root, "src-tauri", "target", "release", "bundle", "nsis", "CastRoom AI_0.1.0_x64-setup.exe"),
    fileName: "CastRoom-AI_0.1.0_x64-setup.exe",
    recommended: false,
  },
  {
    label: "Windows MSI installer",
    source: path.join(root, "src-tauri", "target", "release", "bundle", "msi", "CastRoom AI_0.1.0_x64_en-US.msi"),
    fileName: "CastRoom-AI_0.1.0_x64_en-US.msi",
    recommended: false,
  },
];

const portableSources = [
  {
    label: "desktop executable",
    source: path.join(root, "src-tauri", "target", "release", "CastRoom AI.exe"),
    target: path.join(portableAppDir, "CastRoom AI.exe"),
  },
  {
    label: "local AI resources",
    source: path.join(root, "resources"),
    target: path.join(portableAppDir, "resources"),
  },
  {
    label: "default character packs",
    source: path.join(root, "character-packs"),
    target: path.join(portableAppDir, "character-packs"),
  },
  {
    label: "license",
    source: path.join(root, "LICENSE"),
    target: path.join(portableAppDir, "LICENSE"),
  },
];

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(portableAppDir, { recursive: true });

for (const entry of portableSources) {
  if (!fs.existsSync(entry.source)) {
    throw new Error(`Missing portable ${entry.label}: ${entry.source}`);
  }
  fs.cpSync(entry.source, entry.target, { recursive: true });
}

const testerReadme = `CastRoom AI portable test build

How to run:

1. Extract this zip.
2. Open the "CastRoom AI" folder.
3. Run "CastRoom AI.exe".
4. Try local AI chat first. You can also configure your own external AI endpoint if needed.

Notes:

- This build is for testing and feedback.
- Local model and runner assets are included for basic local AI chat.
- API keys, user data, runtime data, logs, node_modules, and source build caches are not included.
- Please report crashes, launch problems, confusing UI, provider compatibility issues, local AI behavior issues, and voice issues.
`;

fs.writeFileSync(path.join(portableAppDir, "README_TESTERS.txt"), testerReadme, "utf8");

execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "& { param($source, $dest) Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($source, $dest, [System.IO.Compression.CompressionLevel]::Optimal, $false) }",
    portableStageDir,
    portableZipPath,
  ],
  { stdio: "inherit" },
);

fs.rmSync(portableStageDir, { recursive: true, force: true });

const copied = [];
for (const asset of assets) {
  if (!fs.existsSync(asset.source)) {
    throw new Error(`Missing release asset source: ${asset.source}`);
  }
  const target = path.join(outDir, asset.fileName);
  fs.copyFileSync(asset.source, target);
  const stat = fs.statSync(target);
  copied.push({
    ...asset,
    target,
    size: stat.size,
    sha256: sha256(target),
  });
}

copied.unshift({
  label: "Windows portable test zip",
  target: portableZipPath,
  fileName: portableZipName,
  recommended: true,
  size: fs.statSync(portableZipPath).size,
  sha256: sha256(portableZipPath),
});

const checksumLines = copied.map((asset) => `${asset.sha256}  ${asset.fileName}`);
fs.writeFileSync(path.join(outDir, "SHA256SUMS.txt"), `${checksumLines.join("\n")}\n`, "utf8");

const releaseNotes = `# CastRoom AI ${version}

This is an early Windows test build.

## Download

Recommended:

- ${copied.find((asset) => asset.recommended)?.fileName}

Alternative:

- ${copied.filter((asset) => !asset.recommended).map((asset) => asset.fileName).join("\n- ")}

## Important notes

- The portable zip is the easiest option for testers: extract it, open the CastRoom AI folder, then run CastRoom AI.exe.
- This build does not include a hosted AI service. Users must configure their own AI provider or local AI assets.
- Local model and runner assets are included in the portable zip and desktop installers for basic local AI chat.
- Runtime data, logs, API keys, and user memory data are not part of the source repository.
- This is a test/demo-oriented build, not a final public product release.

## Checksums

\`\`\`text
${checksumLines.join("\n")}
\`\`\`

## Asset sizes

${copied.map((asset) => `- ${asset.fileName}: ${formatBytes(asset.size)}`).join("\n")}
`;

fs.writeFileSync(path.join(outDir, "RELEASE_NOTES.md"), releaseNotes, "utf8");

console.log(`GitHub release assets prepared: ${outDir}`);
for (const asset of copied) {
  console.log(`- ${asset.fileName}: ${formatBytes(asset.size)}`);
}
