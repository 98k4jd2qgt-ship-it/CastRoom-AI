# CastRoom AI

![CastRoom AI banner](docs/screenshots/castroom-ai-banner.png)

[![Latest release](https://img.shields.io/github/v/release/98k4jd2qgt-ship-it/CastRoom-AI?label=latest%20build)](https://github.com/98k4jd2qgt-ship-it/CastRoom-AI/releases/latest)
[![Windows](https://img.shields.io/badge/platform-Windows%2010%2F11-7cc7ff)](#requirements--开发环境)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0--only-7bdba9)](LICENSE)
[![Early access](https://img.shields.io/badge/status-early%20access-f0c674)](#status--当前状态)

A Windows desktop app for running rooms of AI characters, with Director-paced scenes, scoped memory, and configurable AI.

一个用于运行 AI 角色房间的 Windows 桌面应用，带 Director 场景推进、分作用域记忆和可配置 AI。

**Download:** [Latest test build](https://github.com/98k4jd2qgt-ship-it/CastRoom-AI/releases/latest) · **Feedback:** [Report an issue](https://github.com/98k4jd2qgt-ship-it/CastRoom-AI/issues) · **AI services:** [Support notes](https://98k4jd2qgt-ship-it.github.io/castroom-ai-support/#ai-services)

CastRoom AI is an early Windows desktop app for running multi-character AI rooms. It focuses on Director-paced scenes, role channels, reviewable memory, and configurable local/external AI.

CastRoom AI 是一个早期 Windows 桌面应用，用于运行多角色 AI 房间。重点是 Director 场景推进、角色频道、可审核记忆，以及可配置的本地/外部 AI。

## Why CastRoom AI / 为什么是 CastRoom AI

| Common pattern | CastRoom AI focus |
| --- | --- |
| Single-character chat | Room with multiple roles, shared context, and one-on-one chat when needed. |
| Simple group conversation | Director-paced scene flow with speaker choice, goals, and room pressure. |
| Static background notes | Reviewable memory candidates, active facts, and relationship graph inspection. |
| Hosted character service | Local-first desktop app with optional local AI and configurable external AI endpoints. |
| Developer workflow tool | A playable desktop room experience, not only automation logic. |

| 常见模式 | CastRoom AI 的重点 |
| --- | --- |
| 单角色聊天 | 多角色 Room，同时保留需要时的一对一聊天。 |
| 简单群聊 | Director 控制场景节奏，选择发言者、目标和房间压力。 |
| 静态背景资料 | 待确认记忆候选、active 事实和关系图谱查看。 |
| 托管角色服务 | 本地优先桌面应用，可选本地 AI，并支持配置外部 AI endpoint。 |
| 开发者流程工具 | 可以直接体验的桌面房间体验，不只是自动化逻辑。 |

## Core Experience / 核心体验

- Multi-character Rooms support roles that talk, react, argue, or cooperate in shared scenes.
- Director pacing can choose the next speaker and move the scene forward when the room should continue.
- Public, private, and faction channels separate shared conversation from hidden knowledge or strategy.
- Prompt Center keeps Room, Director, and character rules editable from the app.
- Memory review surfaces long-term candidates and relationship graph facts before they become trusted context.
- AI setup supports basic local chat when local assets are available, plus configurable external AI endpoints.

- 多角色 Room 支持角色在共享场景中聊天、反应、争论或协作。
- Director 节奏控制可以选择下一位发言者，并在房间需要继续时推进场景。
- 公开、私密和阵营频道用于区分公共对话、隐藏信息和策略讨论。
- Prompt Center 让 Room、Director 和角色规则可以直接在应用内编辑。
- 记忆审核会展示长期候选和关系图谱事实，再进入可信上下文。
- AI 设置支持本地资源可用时的基础本地聊天，也支持配置外部 AI endpoint。

## Screenshots / 界面预览

| Room workspace | Prompt Center | Memory view |
| --- | --- | --- |
| ![Room workspace](docs/screenshots/room-workspace.png) | ![Prompt Center](docs/screenshots/prompt-center.png) | ![Memory view](docs/screenshots/memory-view.png) |

## Status / 当前状态

CastRoom AI is in early access. The app is usable for testing rooms, characters, prompts, memory, and AI setup, but it is still changing quickly.

CastRoom AI 仍处于早期版本，适合测试 Room、角色、提示词、记忆和 AI 配置；产品还在快速变化。

CastRoom AI is an early release. Testing across Windows versions, hardware, drivers, AI providers, and local model setups is still limited. Bug reports and usability feedback are welcome and will help improve future updates. :)

CastRoom AI 仍处于早期版本。不同 Windows 版本、硬件、驱动、AI provider 和本地模型配置下的测试覆盖仍然有限，欢迎反馈 bug 和可用性问题，以帮助后续版本改进。:)

## Current Limitations / 当前限制

- Local model assets may not be included in every release package.
- External AI requires separate provider configuration.
- Room, Director, memory, voice, and local AI behavior are still being refined.
- Feedback is especially useful for setup friction, crashes, provider compatibility, confusing room flow, and memory behavior.

- 并非每个发布包都会包含本地模型资源。
- 外部 AI 需要单独配置 provider。
- Room、Director、记忆、语音和本地 AI 行为仍在打磨。
- 安装阻碍、崩溃、provider 兼容、房间流程困惑和记忆行为反馈尤其有价值。

## Highlights / 功能亮点

| Area | What it does |
| --- | --- |
| Rooms | Multi-character rooms with shared context, role state, and separate channels. |
| Director | Automatic pacing for speaker selection, goals, scene pressure, and scene advancement. |
| Channels | Public chat, private threads, and faction channels for hidden knowledge or strategy. |
| Prompt Center | Editable Room, Director, and character rules with presets and preview flow. |
| Memory Graph | Reviewable memory candidates, active facts, scoped memory, and relationship graph inspection. |
| AI Setup | Basic local AI chat when local assets are available; external AI requires user configuration. |

| 模块 | 能力 |
| --- | --- |
| Rooms | 多角色房间，带共享上下文、角色状态和独立频道。 |
| Director | 自动节奏控制，覆盖发言者选择、目标、场景压力和场景推进。 |
| Channels | 公开聊天、私密线程和阵营频道，用于隐藏信息或策略讨论。 |
| Prompt Center | 可编辑 Room、Director 和角色规则，并支持 preset 与预览流程。 |
| Memory Graph | 待确认记忆候选、active 事实、分作用域记忆和关系图谱查看。 |
| AI Setup | 本地资源可用时提供基础本地 AI 聊天；支持配置外部 AI endpoint。 |

## Repository Scope / 仓库范围

The public source repository does not include large local models, runner binaries, build output, installer packages, logs, runtime data, API keys, or user data.

公开源码仓库不包含大型本地模型、runner 二进制、构建产物、安装包、日志、运行数据、API Key 或用户数据。

Excluded assets are distributed separately through GitHub Releases when available.

被排除的离线资源会在可用时通过 GitHub Releases 单独提供。

## Download Builds / 下载测试版

Windows builds are distributed through **GitHub Releases**, not committed to the source repository. The portable zip is the simplest no-install option.

Windows 构建通过 **GitHub Releases** 分发，不直接提交到源码仓库。portable zip 是最简单的免安装选择。

Download the latest build from [GitHub Releases](https://github.com/98k4jd2qgt-ship-it/CastRoom-AI/releases/latest). Use the newest portable zip for no-install testing, or the newest installer if you prefer an installed build.

Portable run path: portable zip -> extract -> open the `CastRoom AI` folder -> run `CastRoom AI.exe`.

从 [GitHub 最新 Release](https://github.com/98k4jd2qgt-ship-it/CastRoom-AI/releases/latest) 下载最新测试版。免安装测试优先选择最新 portable zip；如果想安装到系统里，再选择最新 installer。

Portable 运行路径：portable zip -> 解压 -> 打开 `CastRoom AI` 文件夹 -> 运行 `CastRoom AI.exe`。

Before running a downloaded build, verify its SHA256 value against the `SHA256SUMS.txt` file attached to the same release.

运行下载的测试包前，建议用同一个 Release 附带的 `SHA256SUMS.txt` 校验 SHA256。

## Requirements / 开发环境

- Windows 10/11
- Node.js 20 or newer
- npm
- Rust stable toolchain
- Microsoft WebView2 Runtime

## For Developers / 开发者说明

The source repository keeps development checks, desktop packaging scripts, release asset validation, and privacy-boundary checks separate from the user-facing build.

源码仓库保留开发校验、桌面打包脚本、发布资源检查和隐私边界检查；这些内容与公开下载版分开管理。

## Development / 本地开发

Clone the source repository:

```powershell
git clone https://github.com/98k4jd2qgt-ship-it/CastRoom-AI.git
cd CastRoom-AI
```

克隆源码仓库：

```powershell
git clone https://github.com/98k4jd2qgt-ship-it/CastRoom-AI.git
cd CastRoom-AI
```

Install dependencies:

```powershell
npm.cmd install
```

Run validation:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run check:rust
```

Run the development server:

```powershell
npm.cmd run dev
```

Build the desktop application:

```powershell
npm.cmd run tauri -- build
```

Desktop package readiness check:

```powershell
npm.cmd run check:desktop-package
```

## AI Configuration / AI 配置

CastRoom AI does not provide a hosted AI service. Users configure their own cloud provider credentials or optional local model assets.

CastRoom AI 不提供托管 AI 服务。云端模型服务需要单独配置；本地模型资源为可选资源。

Typical configuration areas:

- Cloud chat provider and model
- Optional local chat model
- Optional vision model
- Optional speech or voice tools
- Per-room generation settings
- Per-role or Director overrides

## Offline Assets / 离线资源

Large offline assets are intentionally excluded from this source repository.

大型离线资源不会进入源码仓库。

Expected locations after downloading release assets:

```text
resources/models/chat/<model-id>/
resources/runners/llama.cpp/
resources/runners/whisper.cpp/
```

Release asset packages should include:

- Model or runner files
- SHA256 checksums
- Third-party license files
- Source notices where required

See:

- [resources/models/README.md](resources/models/README.md)
- [resources/runners/README.md](resources/runners/README.md)

## Privacy And Data Boundary / 隐私与数据边界

The following must not be committed to the public repository:

- API keys and `.env` files
- Runtime memory data
- Logs and diagnostics containing user content
- Local screenshots or temporary files
- Installer output and staging artifacts
- Local model and runner binaries

以下内容不得提交到公开仓库：

- API Key 和 `.env` 文件
- 运行期记忆数据
- 包含用户内容的日志和诊断数据
- 本地截图或临时文件
- 安装包输出和 staging 产物
- 本地模型与 runner 二进制

## Character Packs / 角色包

Character packs define role metadata, prompts, optional voice settings, and optional visual/emotion assets. Room avatar images are only used when a pack has the complete required Room emotion set.

角色包用于定义角色元数据、提示词、可选语音设置和可选视觉/表情资源。Room 头像只会在角色包具备完整 Room 标准表情资源时启用。

## License / 许可证

Project source code is licensed under **GPL-3.0-only**. See [LICENSE](LICENSE).

项目源码使用 **GPL-3.0-only** 协议。详见 [LICENSE](LICENSE)。

Third-party models, runners, fonts, images, and character assets are governed by their own licenses and notices. Assets distributed through GitHub Releases must include their own license and source notices.

第三方模型、runner、字体、图片和角色素材遵循各自许可证。通过 GitHub Releases 分发的资源包必须单独附带对应许可证和来源说明。

## Contributing / 贡献

Issues and pull requests are welcome for focused fixes, tests, documentation, and small improvements. Please avoid submitting private data, model binaries, runner binaries, generated installer output, or unrelated large assets.

欢迎提交聚焦的 issue 和 pull request，包括 bug 修复、测试、文档和小范围改进。请不要提交私人数据、模型二进制、runner 二进制、安装包产物或无关大型资源。

Before opening a pull request, run:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run check:rust
```
