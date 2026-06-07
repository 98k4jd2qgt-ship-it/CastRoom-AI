import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const version = process.env.CASTROOM_RELEASE_VERSION ?? "v0.1.2";
const assetStamp = process.env.CASTROOM_RELEASE_ASSET_STAMP ?? "2026-06-07";
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

for (const portableDataPath of [
  path.join(portableAppDir, "portable-data", ".gitkeep"),
  path.join(portableAppDir, "portable-data", "app-data", ".gitkeep"),
  path.join(portableAppDir, "portable-data", "runtime-data", ".gitkeep"),
  path.join(portableAppDir, "portable-data", "character-packs", ".gitkeep"),
]) {
  fs.mkdirSync(path.dirname(portableDataPath), { recursive: true });
  fs.writeFileSync(portableDataPath, "", "utf8");
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
- This portable build stores new local data under "portable-data" next to CastRoom AI.exe. Delete that folder to reset the test build.
- The included portable-data folders contain only empty .gitkeep placeholders.
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
- The portable zip stores new local data under "portable-data" next to CastRoom AI.exe. Delete that folder to reset the test build.
- The included portable-data folders contain only empty .gitkeep placeholders.
- This is a test/demo-oriented build, not a final public product release.

## Development log

This update is focused on making Room sessions easier to reset, easier to read, and safer to test from a fresh download.

### Room reset and memory isolation

- New Rooms no longer reuse the old deterministic \`new-room\` scope after a deleted room is recreated.
- Deleting a Room now persists deletion for every related memory and graph scope the MemoryStore actually cleared.
- Semantic observations are included in Room memory scope cleanup.
- Public Room memory, private/faction memory, Director-only memory, and role perspectives remain separated.

### Room UI cleanup

- Removed the "How this room works" information card from the Room rules panel.
- Simplified the visible Room controls so users see controls and prompt editing first, not explanatory policy text.

### Director and room flow

- Director no longer schedules \`@You\` as the next actor during automatic Room flow.
- Director backstage notes are cleaned so user-instruction text does not leak into scheduling output.
- Continuous Room flow, fill-gap behavior, and speaker distribution remain available for multi-character testing.

### Memory and graph behavior

- Memory confidence and perspective graph validation remain part of the release check.
- Claimed, believed, confirmed, disputed, and hidden-scope memory boundaries continue to be checked before release.
- Public chat is routed to Room public memory; private, faction, and Director-only content stays scoped.

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
