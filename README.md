# CastRoom AI

![CastRoom AI banner](docs/screenshots/castroom-ai-banner.png)

[![Latest release](https://img.shields.io/github/v/release/98k4jd2qgt-ship-it/CastRoom-AI?label=latest%20build)](https://github.com/98k4jd2qgt-ship-it/CastRoom-AI/releases/latest)
[![Windows](https://img.shields.io/badge/platform-Windows%2010%2F11-7cc7ff)](#requirements--开发环境)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0--only-7bdba9)](LICENSE)
[![Early access](https://img.shields.io/badge/status-early%20access-f0c674)](#status--当前状态)

A Windows desktop app for automated multi-character scene simulation, built around visibility, pacing, and memory governance.

一个用于自动化多角色剧情推演的 Windows 桌面应用，核心是可见性、节奏控制和记忆治理。

Download: [Latest test build](https://github.com/98k4jd2qgt-ship-it/CastRoom-AI/releases/latest) · Feedback: [Report an issue](https://github.com/98k4jd2qgt-ship-it/CastRoom-AI/issues) · AI services: [Support notes](https://98k4jd2qgt-ship-it.github.io/castroom-ai-support/#ai-services)

CastRoom AI is not just a room with several bots replying in turn. It is trying to make a scene keep moving: who can see what, who chooses to speak, when the Director should step in, and which memories can be trusted later.

CastRoom AI 不只是把几个 AI 放进同一个聊天室里轮流回复。它更关心一个场景如何持续运转：谁能看到什么、谁选择发言、Director 什么时候介入，以及哪些记忆会在之后被信任。

## Why CastRoom AI / 为什么是 CastRoom AI

| Common pattern | CastRoom AI focus |
| --- | --- |
| One-on-one character chat | A room where several characters can share a scene without losing one-on-one scope. |
| Simple group chat | Speaker flow, backstage Director control, and scene pressure instead of endless turn-taking. |
| Static background notes | Reviewable memory, confidence signals, claims, beliefs, conflicts, and confirmed facts. |
| Hosted character app | Local-first Windows desktop app with user-configured AI endpoints. |

| 常见形态 | CastRoom AI 的重点 |
| --- | --- |
| 单角色聊天 | 多个角色共享一个场景，同时保留需要时的一对一作用域。 |
| 简单群聊 | 不只是轮流回复，而是有发言流、后台 Director 和场景压力。 |
| 静态背景资料 | 记忆可以被审核，也会区分置信度、说法、信念、冲突和确认事实。 |
| 托管角色应用 | 本地优先的 Windows 桌面应用，AI endpoint 由用户自己配置。 |

## Core Experience / 核心体验

- Create rooms where characters can talk, listen, argue, cooperate, or stay quiet.
- Let the room continue with automatic speaker flow and optional Director pacing.
- Use public, private, and faction channels to control who knows what.
- Edit Room, Director, and character rules from Prompt Center.
- Review memory candidates, confidence signals, and relationship graph facts before they become trusted context.
- Configure your own external AI endpoint, or use bundled local assets for basic local chat when they are included.

- 创建房间，让多个角色在同一个场景里说话、旁听、争论、协作或沉默。
- 通过自动发言流和可选 Director 节奏控制，让房间继续往下走。
- 用公开、私密和阵营频道控制不同角色能知道什么。
- 在 Prompt Center 里直接编辑房间、Director 和角色规则。
- 在记忆进入可信上下文前，先查看候选、置信度和关系图谱。
- 配置自己的外部 AI endpoint；如果发布包带了本地资源，也可以跑基础本地聊天。

## How It Works / 它是怎么运作的

CastRoom AI is built around visibility, pacing, and memory governance.

CastRoom AI 的核心是可见性、节奏控制和记忆治理。

Rooms
Characters share a public scene, while private threads, faction talk, and Director notes stay separate. A character can only act on information it is allowed to see.

房间
角色共享公开场景，但私聊、阵营讨论和 Director 记录是分开的。角色只能基于自己能看到的信息行动。

Director
The Director usually stays backstage. When needed, it can add narration, judge action results, recover a stuck scene, or push the next beat.

Director
Director 通常待在后台。需要的时候，它会写旁白、裁定行动结果、救回卡住的场景，或者把剧情推到下一拍。

Speaker flow
Characters are not forced to speak every round. The room tries to keep the scene alive without letting the same two characters dominate forever.

发言流程
角色不需要每轮都发言。房间会尽量让场景继续动起来，同时避免永远只有两个人主导对话。

Memory
Public chat belongs to the room. Private and faction information stays hidden from characters who should not know it.

记忆
公开聊天属于房间；私聊和阵营信息不会直接暴露给不该知道的角色。

Memory confidence
A character saying something is not the same as that thing being true. Memory can stay as a claim, a belief, a conflict, or a confirmed fact.

记忆置信度
角色说了什么，不等于那件事就是真的。记忆可以只是说法、信念、冲突，也可以是确认后的事实。

## Screenshots / 界面预览

| Room workspace | Prompt Center | Memory view |
| --- | --- | --- |
| ![Room workspace](docs/screenshots/room-workspace.png) | ![Prompt Center](docs/screenshots/prompt-center.png) | ![Memory view](docs/screenshots/memory-view.png) |

## Status / 当前状态

CastRoom AI is in early access. It can be used to test rooms, characters, prompts, memory, and AI setup, but the project is still changing quickly.

CastRoom AI 仍处于早期版本，可以用来测试房间、角色、提示词、记忆和 AI 配置，但项目还在快速变化。

Testing across Windows versions, hardware, drivers, AI providers, and local model setups is still limited. Bug reports and usability feedback are welcome. :)

不同 Windows 版本、硬件、驱动、AI provider 和本地模型配置下的测试覆盖仍然有限，欢迎反馈 bug 和可用性问题。:)

## Current Limitations / 当前限制

- Local model assets may not be included in every release package.
- External AI requires separate provider configuration.
- Room flow, Director behavior, memory, voice, and local AI are still being refined.
- Feedback is especially useful for setup friction, crashes, provider compatibility, confusing room flow, and memory behavior.

- 并非每个发布包都会包含本地模型资源。
- 外部 AI 需要单独配置 provider。
- 房间流程、Director 行为、记忆、语音和本地 AI 仍在打磨。
- 安装阻碍、崩溃、provider 兼容、房间流程困惑和记忆行为反馈尤其有价值。

## Highlights / 功能亮点

| Area | What it does |
| --- | --- |
| Rooms | Multi-character scenes with shared context, role state, and separate channels. |
| Director | Backstage pacing, narration, action judgement, and stuck-scene recovery. |
| Speaker flow | Automatic turn choice with participation balancing, without forcing everyone to speak. |
| Channels | Public chat, private threads, and faction channels for hidden knowledge or strategy. |
| Prompt Center | Editable Room, Director, and character rules with presets and preview flow. |
| Memory Graph | Reviewable memory candidates, confidence signals, scoped facts, and relationship graph inspection. |
| AI Setup | Basic local chat when local assets are available; external AI requires user configuration. |

| 模块 | 能力 |
| --- | --- |
| Rooms | 多角色场景，带共享上下文、角色状态和独立频道。 |
| Director | 后台节奏控制、旁白、行动裁定和卡场恢复。 |
| Speaker flow | 自动选择发言者并平衡参与度，但不强制所有角色每轮发言。 |
| Channels | 公开聊天、私密线程和阵营频道，用于隐藏信息或策略讨论。 |
| Prompt Center | 可编辑 Room、Director 和角色规则，并支持 preset 与预览流程。 |
| Memory Graph | 待审核记忆候选、置信度信号、分作用域事实和关系图谱查看。 |
| AI Setup | 本地资源可用时提供基础本地聊天；外部 AI 需要用户自己配置。 |

## Repository Scope / 仓库范围

The public source repository does not include large local models, runner binaries, build output, installer packages, logs, runtime data, API keys, or user data.

公开源码仓库不包含大型本地模型、runner 二进制、构建产物、安装包、日志、运行数据、API key 或用户数据。

Excluded assets are distributed separately through GitHub Releases when available.

被排除的离线资源会在可用时通过 GitHub Releases 单独提供。

## Download Builds / 下载测试版

Windows builds are distributed through GitHub Releases, not committed to the source repository. The portable zip is the simplest no-install option.

Windows 构建通过 GitHub Releases 分发，不直接提交到源码仓库。portable zip 是最简单的免安装选择。

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

CastRoom AI 不提供托管 AI 服务。云端模型服务需要用户单独配置；本地模型资源是可选资源。

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

- API key 和 `.env` 文件
- 运行期记忆数据
- 包含用户内容的日志和诊断数据
- 本地截图或临时文件
- 安装包输出和 staging 产物
- 本地模型和 runner 二进制

## Character Packs / 角色包

Character packs define role metadata, prompts, optional voice settings, and optional visual or emotion assets. Room avatar images are only used when a pack has the complete required Room emotion set.

角色包用于定义角色元数据、提示词、可选语音设置和可选视觉/表情资源。Room 头像只会在角色包具备完整 Room 标准表情资源时启用。

## License / 许可证

Project source code is licensed under GPL-3.0-only. See [LICENSE](LICENSE).

项目源码使用 GPL-3.0-only 协议。详见 [LICENSE](LICENSE)。

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
