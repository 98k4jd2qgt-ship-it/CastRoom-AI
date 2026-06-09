# Character Packs

This directory is for local CastRoom AI character pack instances.

The public repository and release packages do not include user character packs. Add your own packs locally after installing or extracting the app.

Typical pack layout:

```text
character-packs/<pack-id>/
  manifest.toml
  prompt/
    character.md
    room.md
  voice/
  subtitles/
  idle/
  emotions/
    happy/
    sad/
    thinking/
  icons/
    avatar.png
  preview.png
```

`manifest.toml` should describe the pack id, prompt paths, optional voice and subtitle paths, and the memory namespace used by the character.

Image assets may use `png`, `jpg`, `jpeg`, or `gif`:

- `idle/*`: neutral room image.
- `emotions/<mood>/*`: mood-specific images.
- `icons/avatar.*`: optional small avatar.
- `preview.*`: optional pack preview image.

If a room character does not have complete image assets, CastRoom AI falls back to the text/avatar placeholder.

Do not put API keys, chat logs, memory files, private notes, or `.env` files in character packs.

## 中文说明

这个目录用于本地 CastRoom AI 角色包实例。

公开源码仓库和 Release 包不会包含用户角色包。安装或解压应用后，可以在本地添加自己的角色包。

角色包通常包含：

- `manifest.toml`：角色包 id、prompt 路径、可选 voice/subtitle 路径、memory namespace。
- `prompt/`：角色长期提示词和房间覆盖提示词。
- `idle/`：默认状态图片。
- `emotions/<mood>/`：不同情绪的图片。
- `icons/avatar.*`：可选头像。
- `preview.*`：可选预览图。

图片支持 `png`、`jpg`、`jpeg`、`gif`。

如果房间角色缺少完整图片资源，CastRoom AI 会回退到文字或头像占位显示。

不要把 API key、聊天记录、记忆文件、私密备注或 `.env` 文件放进角色包。
