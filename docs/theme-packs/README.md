# 主题素材包接口 v1

主题包让外部 Skill 在不改动展厅 JavaScript 的前提下，为现有科学家替换档案软盘、引导画面、文案，并装入一种经过白名单限制的试玩流程。

## 目录结构

```text
<pack-id>/
├── manifest.json
└── assets/
    ├── disk.png
    └── guide.png
```

浏览器导入的是整个文件夹，不是单独的 `manifest.json`。用于传输时可以把目录压缩成 ZIP，但导入前必须解压。

## v1 能做什么

- 覆盖一个现有人物的标题、领域、提问占位、引导说明和主题标签；
- 覆盖该人物的软盘 PNG 与 16:9 引导 PNG；
- 使用 `choice-sequence-v1` 运行 2—5 步“观察—选择—反馈—迁移”试玩；
- 把当前启用主题保存到 IndexedDB；
- 把每个主题的试玩步骤保存到独立 `localStorage` 键；
- 随时恢复默认展厅，不删除原主题、来访者档案或明暗主题存档。

## 明确禁止

主题包不能携带：

- JavaScript、HTML、CSS、WASM、可执行文件或动态模块；
- 远程 URL、`data:` URL、绝对路径和 `../` 路径；
- 未登记文件；
- 任意 HTML 文本或事件属性；
- 自定义公式执行器、`eval`、脚本化条件和人物专用运行时代码。

运行时只认 `manifest.json`、`assets/disk.png` 和 `assets/guide.png`。多出的任何文件都会让整包拒绝导入。

## 校验门槛

- `schema_version` 固定为 `1.0.0`；
- 至少一条 HTTPS 科学来源，并记录素材是“仅本地演示”还是“已批准公开发布”；
- `pack_id` 和人物 ID 使用小写短横线格式；
- 素材必须是真实 PNG，不只看扩展名；
- 每张图必须声明实际宽高与 SHA-256；
- 单素材不超过 3MB，整包不超过 4MB；
- 图片宽高在 128—2048 像素之间；
- 玩法只能选择白名单模板 `choice-sequence-v1`；
- 每步 2—4 个选项，正确选项必须真实存在；
- 文案有长度限制，并禁止 `<`、`>` 和控制字符；
- 目标人物必须已经存在于当前展厅。

完整机器规范见 [`theme-pack.schema.json`](../../theme-packs/schema/theme-pack.schema.json)，可复制模板见 [`manifest.template.json`](../../theme-packs/template/manifest.template.json)。

## 本地校验

```bash
node tools/validate-theme-pack.mjs theme-packs/examples/einstein-photoelectric
```

成功输出：

```text
theme-pack-valid id=einstein-photoelectric-demo target=einstein steps=3
```

## 网页导入

1. 在仓库根目录运行 `python3 -m http.server 4173 --bind 127.0.0.1`；
2. 打开 `http://127.0.0.1:4173/`；
3. 在实验电脑旁点击“导入主题文件夹”；
4. 选择 `theme-packs/examples/einstein-photoelectric/` 整个目录；
5. 页面会自动切换到爱因斯坦；点击实验电脑开始三步试玩；
6. 点击“恢复默认主题”可立即回到原展厅。

导入失败时，页面会显示前三个具体错误并保留此前正在使用的主题。不会出现半导入状态。
