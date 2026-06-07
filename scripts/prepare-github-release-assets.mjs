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

这是一个早期 Windows 测试构建。

## Download

Recommended:

- ${copied.find((asset) => asset.recommended)?.fileName}
${alternativeSection}

## Important notes / 重要说明

- The portable zip is the easiest option for testers: extract it, open the CastRoom AI folder, then run CastRoom AI.exe.
  便携 zip 最适合测试：解压后打开 CastRoom AI 文件夹，运行 CastRoom AI.exe。
- This build does not include a hosted AI service. Users must configure their own AI provider or local AI assets.
  此版本不提供托管 AI 服务。用户需要自行配置外部 AI 服务，或使用本地 AI 资源。
- Local model and runner assets are included in the portable zip and desktop installers for basic local AI chat.
  portable zip 和安装包包含基础本地 AI 聊天所需的模型与 runner 资源。
- Runtime data, character memory data, logs, API keys, .env files, and user data are not included in the release assets or source repository.
  Release 资产和源码仓库不包含运行数据、角色记忆、日志、API key、.env 文件或用户数据。
- Character pack instance folders are not included. The app starts from its built-in default state.
  不包含角色包实例文件夹。应用会从内置默认状态启动。
- The portable zip stores new local data under "portable-data" next to CastRoom AI.exe. Delete that folder to reset the test build.
  portable zip 会把新产生的本地数据放在 CastRoom AI.exe 旁边的 portable-data 文件夹里。删除该文件夹即可重置测试构建。
- The included portable-data folders contain only empty .gitkeep placeholders.
  包内 portable-data 目录只包含空的 .gitkeep 占位文件。
- This is a test/demo-oriented build, not a final public product release.
  这是面向测试和演示的构建，不是最终正式产品版本。

## Development log / 开发日志

This update is focused on making Room sessions easier to reset, easier to read, and safer to test from a fresh download.

本次更新重点是让 Room 更容易重置、更容易阅读，也让新下载的测试包更安全。

### Room reset and memory isolation / 房间重置与记忆隔离

- New Rooms no longer reuse the old deterministic \`new-room\` scope after a deleted room is recreated.
  删除房间后再新建房间，不再复用旧的固定 \`new-room\` 记忆 scope。
- Deleting a Room now persists deletion for every related memory and graph scope the MemoryStore actually cleared.
  删除房间时，会把 MemoryStore 实际清理过的相关记忆和图谱 scope 一并持久化删除。
- Semantic observations are included in Room memory scope cleanup.
  Room 语义观察也纳入房间记忆清理范围。
- Public Room memory, private/faction memory, Director-only memory, and role perspectives remain separated.
  公开房间记忆、私聊/阵营记忆、Director-only 记忆和角色视角继续保持隔离。

### Room UI cleanup / 房间界面精简

- Removed the "How this room works" information card from the Room rules panel.
  移除了 Room 规则面板里的 “How this room works / 这个房间的工作方式” 说明卡片。
- Simplified the visible Room controls so users see controls and prompt editing first, not explanatory policy text.
  精简可见的 Room 控制区域，让用户优先看到控制项和提示词入口，而不是解释性策略文案。

### Director and room flow / Director 与房间推演

- Director no longer schedules \`@You\` as the next actor during automatic Room flow.
  自动推演时，Director 不再把 \`@You\` 安排成下一位行动者。
- Director backstage notes are cleaned so user-instruction text does not leak into scheduling output.
  Director 后台记录会清理用户调度式文本，避免这类内容泄漏进调度输出。
- Continuous Room flow, fill-gap behavior, and speaker distribution remain available for multi-character testing.
  连续推演、补空档和发言分配策略仍可用于多角色测试。

### Memory and graph behavior / 记忆与图谱行为

- Memory confidence and perspective graph validation remain part of the release check.
  记忆置信度和多视角图谱验证仍然是发布检查的一部分。
- Claimed, believed, confirmed, disputed, and hidden-scope memory boundaries continue to be checked before release.
  说法、信念、确认事实、冲突和隐藏 scope 的边界会继续在发布前验证。
- Public chat is routed to Room public memory; private, faction, and Director-only content stays scoped.
  公开聊天会进入 Room public memory；私聊、阵营和 Director-only 内容继续保持各自作用域。

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
