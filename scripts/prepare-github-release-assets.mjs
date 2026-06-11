import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const version = process.env.CASTROOM_RELEASE_VERSION ?? "v0.1.4";
const assetStamp = process.env.CASTROOM_RELEASE_ASSET_STAMP ?? "2026-06-11";
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

This is an early Windows test build for the latest CastRoom AI room system work.

这是 CastRoom AI 房间系统最新改动的 Windows 测试版。

## Download

Recommended:

- ${copied.find((asset) => asset.recommended)?.fileName}
${alternativeSection}

## Important notes / 重要说明

- The portable zip is the easiest option for testers: extract it, open the CastRoom AI folder, then run CastRoom AI.exe.
  portable zip 是最简单的测试方式：解压后打开 CastRoom AI 文件夹，运行 CastRoom AI.exe。
- Testers should configure their own AI provider in the app, or use the included resources when they are available for your setup.
  测试者应在应用里配置自己的 AI provider；如果当前环境可用，也可以使用包内资源。
- Runtime data, character memory, chat logs, API keys, .env files, and user data are not included in the release assets or source repository.
  Release 资产和源码仓库不包含运行数据、角色记忆、聊天记录、API key、.env 文件或用户数据。
- Character pack instance folders are not included. The app starts from its built-in default state.
  不包含角色实例目录；应用会从内置默认状态启动。
- The portable zip stores new local data under portable-data next to CastRoom AI.exe. Delete that folder to reset the test build.
  portable zip 会把新产生的数据放在 CastRoom AI.exe 旁边的 portable-data 文件夹里；删除该文件夹即可重置测试包。
- The included portable-data folders contain only empty .gitkeep placeholders.
  包内 portable-data 目录只包含空的 .gitkeep 占位文件。

## Development log / 开发日志

This update builds on v0.1.3. It focuses on continuous room flow reliability, Director narration routing, privacy boundaries, memory cleanup, and UI stability.

本次更新基于 v0.1.3，重点修复连续自动推进、Director 旁白路由、隐私边界、房间记忆清理和 Room UI 稳定性。

### Room flow and scheduling / 房间推演与调度

- Continuous Room Flow now recovers from soft stops more aggressively. Missing speakers, ordinary user questions, weak repetition, and user silence should not stop continuous flow.
  连续自动推演会更积极地从软停止中恢复；没有明显发言者、普通问句、轻微重复和用户沉默都不应让 continuous 停住。
- Starting Room Flow now primes the next turn immediately instead of waiting for the long idle-gap path.
  启动自动推演后会立即安排下一轮，不再误走较长的空档等待路径。
- Queued auto turns are checked against real timer state. If a queued turn has no valid timer or is overdue, the flow driver re-primes it.
  已排队的自动回合会校验真实 timer；如果 timer 缺失或已经过期，flow driver 会重新排队。
- Active runtime conflicts now retry shortly instead of turning into a user-waiting state.
  运行中冲突会短延迟重试，不再变成等待用户。

### Director behavior / Director 行为

- Director public narration requests from the Director channel are routed through a public narration path instead of being stored as backstage recap text.
  Director 频道里的明确公开旁白请求会走公开旁白路径，不再被当成后台 recap 文本。
- Public Director text is gated against status dumps and scheduling phrases such as Backstage, Reason, Move, Next beat, Current scene, Goal, and Open clues.
  Director 公开文本会拦截 Backstage、Reason、Move、Next beat、Current scene、Goal、Open clues 等状态摘要和调度字段。
- Casual room messages no longer trigger generic action-ruling text unless there is a concrete action that can change room facts.
  日常房间里的普通聊天不会再触发泛化行动裁定；只有明确会改变房间事实的具体行动才会进入裁定。
- Director backstage notes stay in the Director channel and are not injected into ordinary role prompts.
  Director 后台记录保留在 Director 频道，不注入普通角色 prompt。

### Privacy and visibility / 隐私与可见性

- Director-channel, private, faction, and director-only content is blocked from public narration, public status text, public memory, public graph, and ordinary role prompts by default.
  Director 频道、私聊、阵营和 director-only 内容默认不能进入公开旁白、公开状态栏、公开记忆、公开图谱或普通角色 prompt。
- Public status panels use public-safe content only. Private snippets remain in authorized views or developer diagnostics.
  公开状态栏只使用 public-safe 内容；私密片段只保留在授权视角或开发者诊断里。
- Director mention commands stay in the hidden Director channel. Public role mentions remain visible and create one-shot forced replies from mentioned roles.
  导演点名命令留在隐藏 Director 频道；公开角色点名是所有人可见的点名，并创建一次性指定回应。

### Memory and graph / 记忆与图谱

- Room deletion cleanup is stricter: room-scoped memory files, legacy room memory folders, semantic observations, graph claims, Director Script, and Director Channel data are removed for the deleted room id.
  删除房间时会更完整地清理该 roomId 下的房间记忆文件、旧房间记忆目录、语义观察、图谱 claim、Director Script 和 Director Channel 数据。
- Recreated rooms with the same display name start with a new room id and should not inherit deleted room memory.
  新建同名房间会使用新的 roomId，不应继承已删除房间的记忆。
- Memory graph display can synthesize graph nodes from semantic observations without promoting them to confirmed facts.
  记忆图谱可以从语义观察生成展示节点，但不会把它们自动升级为确认事实。
- Duplicate memory handling remains covered by validation so the dashboard should not show the same semantic memory twice.
  重复记忆处理继续纳入校验，记忆面板不应重复显示同一条语义记忆。

### Token and prompt budget / Token 与 prompt 预算

- Casual room turns prefer compact speaker prompts and local scheduling. Full Director or planner calls are reserved for clearer intervention needs.
  日常房间回合优先使用 compact speaker prompt 和本地调度；完整 Director 或 planner 调用只保留给明确需要干涉的场景。
- Director Script is not injected into ordinary role prompts.
  Director Script 不会注入普通角色 prompt。
- Token audit records purpose and usage estimates, not full prompts, keys, or hidden script text.
  Token 审计只记录用途和用量估算，不记录完整 prompt、key 或隐藏剧本文本。

### UI stability / UI 稳定性

- Room message updates are narrowed toward timeline patches, reducing unnecessary room-main and sidebar refreshes.
  房间消息更新更偏向 timeline 局部 patch，减少不必要的主区域和右侧栏刷新。
- Input handling is safer during focus, deletion, and Chinese IME composition.
  输入框在聚焦、删字和中文输入法组合输入时更稳定。
- Ordinary users see stable room status instead of transient runtime diagnostics.
  普通用户看到的是稳定房间状态，而不是瞬时 runtime 诊断字段。

### Release safety / 发布安全

- Source export and release asset checks reject API keys, .env files, runtime memory, chat logs, local data, character instance folders, build caches, and misplaced installer outputs.
  源码导出和 Release 资产校验会拒绝 API key、.env、运行时记忆、聊天日志、本地数据、角色实例目录、构建缓存和错误位置的安装包产物。
- The portable zip includes empty portable-data placeholders only. New user data is created after launch.
  portable zip 只包含空的 portable-data 占位目录；新的用户数据只会在启动后生成。

## Checksums

${checksumLines.join("\n")}

## Asset sizes

${copied.map((asset) => `- ${asset.fileName}: ${formatBytes(asset.size)}`).join("\n")}
`;
fs.writeFileSync(path.join(outDir, "RELEASE_NOTES.md"), releaseNotes, "utf8");

console.log(`GitHub release assets prepared: ${outDir}`);
for (const asset of copied) {
  console.log(`- ${asset.fileName}: ${formatBytes(asset.size)}`);
}
