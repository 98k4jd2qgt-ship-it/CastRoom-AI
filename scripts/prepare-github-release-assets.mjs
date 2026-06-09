import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const version = process.env.CASTROOM_RELEASE_VERSION ?? "v0.1.3";
const assetStamp = process.env.CASTROOM_RELEASE_ASSET_STAMP ?? "2026-06-09";
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

这是一个早期 Windows 测试版本。

## Download

Recommended:

- ${copied.find((asset) => asset.recommended)?.fileName}
${alternativeSection}

## Important notes / 重要说明

- The portable zip is the easiest option for testers: extract it, open the CastRoom AI folder, then run CastRoom AI.exe.
  portable zip 是最简单的测试方式：解压后打开 CastRoom AI 文件夹，运行 CastRoom AI.exe。
- This build does not include a hosted AI service. Users must configure their own AI provider or use local AI assets when available.
  这个版本不提供托管 AI 服务。用户需要自行配置外部 AI，或在资源可用时使用本地 AI。
- Runtime data, character memory, chat logs, API keys, .env files, and user data are not included in the release assets or source repository.
  Release 资产和源码仓库不包含运行数据、角色记忆、聊天记录、API key、.env 文件或用户数据。
- Character pack instance folders are not included. The app starts from its built-in default state.
  Character pack instance folders are not included。应用会从内置默认状态启动。
- The portable zip stores new local data under portable-data next to CastRoom AI.exe. Delete that folder to reset the test build.
  portable zip 会把新产生的本地数据放在 CastRoom AI.exe 旁边的 portable-data 文件夹里。删除该文件夹即可重置测试包。
- The included portable-data folders contain only empty .gitkeep placeholders.
  包内 portable-data 目录只包含空的 .gitkeep 占位文件。
- This is a test/demo-oriented build, not a final public product release.
  这是面向测试和演示的构建，不是最终正式产品版本。

## Development log / 开发日志

This update is larger than the previous build. It focuses on safer visibility boundaries, more reliable automatic room flow, clearer memory behavior, lower token use, and a cleaner first-run package.

这次更新比上个版本覆盖更多内容，重点是私密信息防泄漏、自动推演稳定性、记忆行为、token 降耗，以及更干净的首次启动包。

### Room flow and scheduling / 房间推演与调度

- Continuous Room Flow now treats user silence, ordinary questions, weak repetition, and no obvious speaker as soft conditions. It should keep going unless a hard blocker occurs.
  Continuous 自动推演现在会把用户沉默、普通问句、轻微重复和没有明显发言人视为软状态；除硬阻塞外应继续推进。
- Added a timer watchdog so queued or cooling-down states can recover when the browser timer is missing, overdue, or interrupted by runtime work.
  增加自动推演 timer 自愈逻辑，避免 UI 显示已排队但实际不派发下一轮。
- Casual rooms can pick a role to introduce a fresh topic according to Room Rules instead of stopping because the current topic is quiet.
  日常房间在话题接不下去时，会按 Room Rules 选择角色开新角度，而不是因为冷场停住。
- Fill gap remains one-shot: it fills one missing beat and then observes. Continuous is the mode for ongoing autonomous flow.
  Fill gap 仍然只补一拍；持续自动推进由 Continuous 负责。

### Director behavior / Director 行为

- Director no longer treats ordinary input, short noise, debate setup text, or watcher comments as action rulings.
  Director 不再把普通输入、乱码短句、辩论配置或观战发言误判为行动裁定。
- Public Director output is limited to narration, hosting, phase transitions, clear action results, and necessary summaries.
  Director 的公开发言限制为旁白、主持、阶段切换、明确行动结果和必要总结。
- Backstage Director notes are compressed and kept in the Director channel instead of leaking scheduling text into public chat.
  Director 后台记录会压缩并留在 Director 频道，不把调度字段刷到公开聊天。
- Director Script is a developer tool scoped to room and mode. It is not injected into ordinary role prompts.
  Director Script 是绑定 room + mode 的开发者工具，不会注入普通角色 prompt。

### Privacy and visibility / 隐私与可见性

- Added source-aware Director Script safety. Private, faction, director-only, and Director-channel content cannot become public foreshadowing, public narration, public status text, public graph, or ordinary role prompt content by default.
  增加 Director Script 来源可见性防线。私聊、阵营、Director-only 和 Director 频道内容默认不能变成公开伏笔、公开旁白、公开状态栏、公开图谱或普通角色 prompt 内容。
- Public status panels are sanitized so private or faction snippets do not appear in the normal room sidebar.
  公开状态栏会做可见性清洗，避免私聊或阵营片段出现在普通房间右侧栏。
- User @Director messages are routed to the hidden Director channel. Ordinary roles do not see them.
  用户 @Director 消息会进入隐藏 Director 频道，普通角色不可见。
- Public @Role mentions are visible room mentions and create a one-shot forced reply from the mentioned role.
  公开 @角色 是可见点名，并触发一次性指定回复：被点名角色下一轮回答用户。
- AI role output is cleaned so roles do not create accidental public scheduling or leakage through @ mentions.
  AI 角色正文中的 @ 会被清洗，避免角色自己制造调度或泄漏。

### Debate mode / 辩论模式

- Debate setup messages containing verdict or judge terms are parsed as setup, not as immediate final rulings.
  包含裁判、点评等词的辩论配置会按赛制配置处理，不再误触发即时裁判。
- Strict debate flow can use structured steps so speaker policy and casual fallback do not override the scheduled debater.
  严格辩论流程可以使用结构化步骤，避免发言分配策略或日常兜底绕过当前辩手。
- Director hosts, transitions phases, summarizes clashes, and judges at the final step. It does not argue for either side.
  Director 负责主持、阶段切换、争点总结和最终裁判，不替任一方辩论。

### Memory and graph / 记忆与图谱

- Public room memory, role perspective memory, faction memory, and Director-only memory remain separated by scope and viewer.
  公开房间记忆、角色视角记忆、阵营记忆和 Director-only 记忆继续按 scope 与 viewer 隔离。
- Semantic observations can appear in the Memory list and graph without being automatically promoted to confirmed facts.
  语义观察可以显示在记忆列表和图谱中，但不会自动升级为确认事实。
- Perspective graph display can group semantic observations by scope, subject, and category, so large memory sets do not appear as one pile of nodes.
  视角图谱会按 scope、主体和类别分组语义观察，避免大量记忆节点堆成一团。
- Room deletion cleanup was strengthened so recreated rooms do not inherit deleted room memory.
  加强删除房间后的记忆清理，避免新建同名房间继承已删除房间的旧记忆。
- Duplicate memory handling and dashboard dedup checks remain part of validation.
  重复记忆处理和记忆面板去重仍属于发布校验范围。

### Token and prompt budget / Token 与 prompt 预算

- Casual room turns prefer compact speaker prompts and local scheduling instead of calling the full Director or planner every round.
  日常房间回合优先使用 compact speaker prompt 和本地调度，不再每轮都调用完整 Director 或 planner。
- Director and planner calls are gated to cases such as action ruling, visibility risk, strict phase control, story transition, debate ruling, or local scheduler failure.
  Director 和 planner 调用收紧到行动裁定、可见性风险、严格阶段控制、剧情转场、辩论裁决或本地调度失败等场景。
- Token audit records purpose and usage estimates, not full prompts, keys, or hidden script text.
  Token 审计只记录用途和用量估算，不记录完整 prompt、key 或隐藏剧本文本。

### UI stability / UI 稳定性

- Room UI updates are coalesced to reduce flicker from role state changes, status refreshes, timer updates, and incoming messages.
  房间 UI 更新做了批处理，减少角色状态、状态栏、timer 和消息同时刷新造成的闪动。
- Input handling is safer during focus, deletion, and Chinese IME composition.
  输入框在聚焦、删字和中文输入法组合输入时更稳定。
- The room sidebar is simplified so ordinary users see room status and controls instead of internal diagnostics.
  右侧房间栏更简洁，普通用户优先看到房间状态和控制项，而不是内部诊断字段。

### Release safety / 发布安全

- The source export and release asset checks reject API keys, .env files, runtime memory, chat logs, local data, character instance folders, build caches, and installer output in the wrong place.
  源码导出和 Release 资产校验会拒绝 API key、.env、运行期记忆、聊天日志、本地数据、角色实例目录、构建缓存和错误位置的安装包产物。
- The portable zip includes empty portable-data placeholders only. New user data is created after launch.
  portable zip 只包含空的 portable-data 占位目录；新的用户数据只会在启动后生成。

## Checksums

${checksumLines.join("\n")}

## Asset sizes

${copied.map((asset) => `- ${asset.fileName}: ${formatBytes(asset.size)}`).join("\n")}
`;fs.writeFileSync(path.join(outDir, "RELEASE_NOTES.md"), releaseNotes, "utf8");

console.log(`GitHub release assets prepared: ${outDir}`);
for (const asset of copied) {
  console.log(`- ${asset.fileName}: ${formatBytes(asset.size)}`);
}
