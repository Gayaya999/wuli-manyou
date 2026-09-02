# 给 Codex Skill 的主题包创作约定

当 Skill 要为“物理漫游”生成一个新人物主题时，必须把本仓库视为稳定宿主，只生成主题数据和两张批准素材，不直接改写 `script.js`、`styles.css` 或页面跳转。

## 固定工作流

1. 读取 `theme-packs/schema/theme-pack.schema.json` 和 `theme-packs/template/manifest.template.json`；
2. 从 `script.js` 中确认 `target_scientist_id` 已存在；
3. 先完成科学事实、学习流程和素材授权审查，把直接科学来源写入 `sources`；
4. 生成一张透明软盘 PNG 和一张完整 16:9 引导 PNG；
5. 把玩法翻译成 2—5 步 `choice-sequence-v1` 配置；
6. 计算图片真实尺寸和 SHA-256，写入 manifest；
7. 运行 `node tools/validate-theme-pack.mjs <pack-folder>`；
8. 启动网页并通过“导入主题文件夹”真实试玩；
9. 导入失败时只修主题目录，不修改宿主来绕过校验。

## Skill 任务模板

```text
为“物理漫游”制作一个受限主题素材包：

- 人物：<现有 scientist id 与中文名>
- 核心发现：<一个科学关系>
- 受众：初中主线，可选高中解释
- 时长：3—5 分钟
- 输出目录：theme-packs/generated/<pack-id>/

只允许输出 manifest.json、assets/disk.png、assets/guide.png。
玩法必须使用 choice-sequence-v1，不得输出 JS、HTML、CSS、远程 URL、data URL、WASM 或其他文件。
每步先让玩家观察或判断，再显示解释；最后一步必须迁移到变化后的情境。
所有文案使用纯文本，不写标签。
未完成素材授权审查时，`usage.license_status` 必须保持 `local-demo-only`。
完成后计算两张 PNG 的真实尺寸与 SHA-256，运行仓库验证器，并在网页导入入口真实试玩。
如果现有模板表达不了科学关系，停止并报告“需要新增通用玩法模板”，不要把人物专用逻辑塞进主题包。
```

## 生图与素材要求

- `disk.png`：透明 PNG，保持现有软盘展示比例，人物身份清楚；
- `guide.png`：完整连贯的 16:9 场景，不在图片中生成按钮、公式或网页文字；
- 不把器物拆成贴纸覆盖在背景上；
- 不使用来源不明的第三方游戏素材；
- 主题包发布前另行保存生成工具、完整提示词、参考图和公开使用许可记录；manifest 中的状态只是发布门禁，不代替完整证据。

## 兼容与降级

- 主题没有导入时，宿主继续使用原软盘、原引导图和原静态弹窗；
- 主题损坏时，不改变当前激活主题；
- 主题被停用时，只清除激活标记，不动 `qo-alt-theme` 与 `qo-visitor-disks`；
- 新玩法必须先进入宿主白名单，再允许主题包引用。
