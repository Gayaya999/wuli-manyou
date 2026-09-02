# 物理漫游

挑战杯物理展览站的独立新界面：科学家软盘轮播、实验窗口，以及按人物隔离的对话舱。

## 运行展览页

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

打开：

```text
http://127.0.0.1:4173/
```

## 科学家对话

密钥只放在仓库根目录的 `.env`，不要写进网页。复制 `.env.example` 后填入 Model Studio 的兼容模式地址与 key，然后启动代理：

```bash
python3 -m pip install -r server/requirements.txt
python3 -m uvicorn server.app:app --reload --port 8787
```

档案里已写好的问题由 `data/scientist-agents.json` 回答；其他问题按当前科学家的人设调用 `qwen3.8-flash`。

## 导入人物主题包

展厅支持不执行脚本的受限主题包。主题包只能包含 `manifest.json`、两张经过指纹验证的 PNG，以及白名单玩法配置。

页面启动后，在实验电脑旁点击“导入主题文件夹”，可直接选择示例：

```text
theme-packs/examples/einstein-photoelectric/
```

导入后页面会切换到爱因斯坦主题，点击实验电脑即可进入三步光电效应试玩。验证方式：

```bash
node tools/validate-theme-pack.mjs theme-packs/examples/einstein-photoelectric
node --test tests/*.test.mjs
```

完整规范、错误回退、Skill 创作约定和模板见 [`docs/theme-packs/`](docs/theme-packs/README.md)。

## 导入完整小游戏模块

“导入完整小游戏文件夹”是给科学游戏创作 Skill 使用的入口。它和上面的主题包不同：导入成功后会在顶部软盘滑块新增一位科学家；选中软盘后，点击下方电脑，会在网站内直接运行完整小游戏。

Skill 应导出 `wuli-science-module-1` 文件夹：

```text
<作品名>-wuli-module/
├── module.json
├── assets/disk.png
├── assets/guide.png
└── game-pack/              # 纯内容、素材、关卡与规则数据
```

网站会核对 PNG 尺寸和指纹、完整游戏素材指纹，以及内容包版本；它拒绝 JavaScript、HTML、CSS、Python、C/C++、WASM 和可执行文件。小游戏运行程序始终由本网站保存的运行器提供，上传包不会携带或执行自己的代码。

本地导入只在当前浏览器页面里预览，不会上传到任何服务器。未来上线时，公开站可以继续保留这个“本地预览”入口；而“发布到社区”应单独做成受保护的后台上传接口，服务器验包、保存合格模块后再让所有访客在线游玩。没有管理员保护前，不要开放公共发布接口。

当前没有登录时，只有拥有网站仓库的人可以用发布工具把已验过的模块放进公开目录；部署后，访客打开网站就会看到这些公开软盘：

```bash
node tools/publish-game-module.mjs /path/to/<作品名>-wuli-module
```

这不是公共上传入口，浏览器访客无法调用它。

相关验证：

```bash
node --test tests/*.test.mjs
```

## 社区展板

顶部导航的“社区”打开 `community.html`，集中陈列当前公开发布的科学小游戏。展板清单读取 `published-modules/index.json`，每张卡片展示软盘封面、领域、科学家、作者与版本；点击“去展厅试玩”即回到展厅加载对应小游戏。

当前首位展板是 `newton-gravity`（牛顿与万有引力）。精选阶段由仓库负责人用上面的发布工具把验证通过的模块放进 `published-modules/`，访客打开网站即可看到，创作者投稿入口后续再开放。
