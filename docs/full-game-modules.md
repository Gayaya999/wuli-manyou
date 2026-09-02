# 完整小游戏模块

这是“物理漫游”与 `build-science-adventure-pack` Skill 的对接格式。一个模块是**内容与素材包**，不是可执行游戏工程。

## 使用流程

1. 创作者用 Skill 制作科学小游戏，并导出完整小游戏模块。
2. 在物理漫游的实验电脑旁选择“导入完整小游戏文件夹”。
3. 验证通过后，顶部软盘滑块新增这位科学家。
4. 选中软盘，点击下方电脑，在网站内试玩完整小游戏。

本地导入只存在于当前页面，不会上传文件。它适合创作者在发布前检查软盘、引导图和小游戏是否都正确。

## 包结构

```text
<module-id>-wuli-module/
├── module.json
├── assets/
│   ├── disk.png
│   └── guide.png
└── game-pack/
    ├── manifest.json
    ├── scientist.json
    ├── concept.json
    ├── experience.json
    ├── models.json
    ├── visuals.json
    ├── sources.json
    ├── licenses.json
    └── qa/release-report.json
```

`module.json` 使用 `wuli-science-module-1`；`game-pack/manifest.json` 使用内容包版本 `2.0.0`。

## 安全边界

- 允许：JSON、图片、音频、字体、素材元数据和关卡规则数据。
- 禁止：JavaScript、HTML、CSS、Python、C/C++、WASM、可执行文件，以及任意代码入口。
- 网页在导入时验证软盘图、引导图、游戏素材的 SHA-256 指纹。
- 游戏在受限 iframe 中运行；运行器、样式和页面结构都由主站提供。为让本地导入的字体与素材可读，iframe 与主站同源，但作品包仍不能携带任何代码。

## 上线时的两条路径

- **本地预览**：浏览器直接读用户主动选择的文件夹，不上传服务器。
- **公开发布**：后续增加仅管理员可用的服务端接口。服务端再次验包、存到作品目录或对象存储、生成发布记录；公开页面只读取已经发布的作品。

在管理员登录和服务端验包准备好以前，不开放任何公开上传接口。

当前可先由站长在仓库中运行 `node tools/publish-game-module.mjs <模块目录>`：它把模块复制到公开目录并更新作品索引。部署静态网站后，首页会自动读取索引、显示已发布软盘并让访客直接游玩；普通访客无法通过网页调用这个发布工具。
