# 角色包图片准备说明

角色图片由你自行准备。自然状态和情绪图片都支持 `png`、`jpg`、`jpeg`、`gif`：

- `idle/*.{png,jpg,jpeg,gif}`：自然状态图片，推荐 1024 x 1024，最小 512 x 512。
- `emotions/<mood>/*.{png,jpg,jpeg,gif}`：情绪图片，推荐 1024 x 1024，最小 512 x 512。
- `icons/avatar.{png,jpg,jpeg,gif}`：512 x 512，可选。
- `preview.{png,jpg,jpeg,gif}`：1280 x 720，可选。

格式建议：

- PNG：推荐用于透明背景角色图。
- JPG/JPEG：可以直接使用，但没有透明通道，可能带背景。
- GIF：可以用于自然状态或情绪动画；性能不足时会降级为首帧或文本占位。

目录示例：

```text
character-packs/<pack-id>/
  idle/
    001.jpg
  emotions/
    happy/
      001.jpg
    sad/
      001.png
    surprised/
      001.gif
```

运行时会自动扫描角色包目录内实际存在的 `png/jpg/jpeg/gif` 文件，不要求固定命名为 `001.png`。

加载规则：

- 当前情绪目录检索到图片：随机选择其中一张加载。
- 当前情绪目录没有图片：回退到 `idle` 目录。
- `idle` 也没有图片：不加载图片，显示文本占位。

完整尺寸规范见 `docs/asset-size-guide.md`。
