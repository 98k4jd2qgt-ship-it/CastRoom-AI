import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const version = process.env.CASTROOM_RELEASE_VERSION ?? "v0.1.1";
const assetStamp = process.env.CASTROOM_RELEASE_ASSET_STAMP ?? "2026-06-06";
const appVersion = version.replace(/^v/i, "");
const outDir = path.join(root, "artifacts", "github-release", version);
const portableStageDir = path.join(outDir, "portable-stage");
const portableAppDir = path.join(portableStageDir, "CastRoom AI");
const assetVersion = version.startsWith("v") ? version : `v${version}`;
const assetPrefix = `CastRoom-AI_${assetVersion}_${assetStamp}`;
const portableZipName = `${assetPrefix}_windows-portable.zip`;
const portableZipPath = path.join(outDir, portableZipName);

function firstExistingPath(paths) {
  return paths.find((candidate) => fs.existsSync(candidate)) ?? paths[0];
}

const assets = [
  {
    label: "Windows NSIS installer",
    source: firstExistingPath([
      path.join(root, "src-tauri", "target", "release", "bundle", "nsis", `CastRoom AI_${appVersion}_x64-setup.exe`),
      path.join(root, "src-tauri", "target", "release", `CastRoom AI_${appVersion}_x64-setup.exe`),
    ]),
    fileName: `${assetPrefix}_x64-setup.exe`,
    recommended: false,
  },
  {
    label: "Windows MSI installer",
    source: firstExistingPath([
      path.join(root, "src-tauri", "target", "release", "bundle", "msi", `CastRoom AI_${appVersion}_x64_en-US.msi`),
      path.join(root, "src-tauri", "target", "release", `CastRoom AI_${appVersion}_x64_en-US.msi`),
    ]),
    fileName: `${assetPrefix}_x64_en-US.msi`,
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
    label: "character pack README",
    source: path.join(root, "character-packs", "README.md"),
    target: path.join(portableAppDir, "character-packs", "README.md"),
  },
  {
    label: "character pack placeholder",
    source: path.join(root, "character-packs", ".gitkeep"),
    target: path.join(portableAppDir, "character-packs", ".gitkeep"),
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
  fs.mkdirSync(path.dirname(entry.target), { recursive: true });
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
- API keys, user data, runtime data, character memory data, logs, node_modules, and source build caches are not included.
- Character pack instance folders are not included. The app starts from its built-in default state.
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
    console.warn(`Skipping missing release asset source: ${asset.source}`);
    continue;
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

const alternativeAssets = copied.filter((asset) => !asset.recommended);
const alternativeSection = alternativeAssets.length
  ? `\nAlternative:\n\n- ${alternativeAssets.map((asset) => asset.fileName).join("\n- ")}\n`
  : "";

const releaseNotes = `# CastRoom AI ${version} - ${assetStamp}

This is an early Windows test build.

## Download

Recommended:

- ${copied.find((asset) => asset.recommended)?.fileName}
${alternativeSection}

## Important notes

- The portable zip is the easiest option for testers: extract it, open the CastRoom AI folder, then run CastRoom AI.exe.
- This build does not include a hosted AI service. Users must configure their own AI provider or local AI assets.
- Local model and runner assets are included in the portable zip and desktop installers for basic local AI chat.
- Runtime data, character memory data, logs, API keys, .env files, and user data are not included in the release assets or source repository.
- Character pack instance folders are not included. The app starts from its built-in default state.
- This is a test/demo-oriented build, not a final public product release.

## What changed

- Added Director Channel and backstage Director scheduling so scheduling notes stay out of the main room.
- Cleaned public Director narration so the main channel keeps scene, environment, action result, and phase summary text.
- Improved one-shot casual replies and room auto-flow semantics for fill_gap and continuous modes.
- Added speaker distribution behavior to reduce two-character loops and long-term lurkers.
- Fixed public/private memory routing: public chat now appears in Room public memory, while private, faction, and Director-only memory stays scoped.
- Added multi-view memory confidence and governance concepts for claims, beliefs, confirmed facts, conflicts, and review candidates.
- Updated Memory Graph and memory dashboard behavior for candidates, confidence, authorized hidden views, and recent public activity.
- Improved default Prompt Center templates for general multi-character rooms and reasoner-style models.
- Updated the GitHub README, screenshots, positioning, and memory confidence messaging.

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
