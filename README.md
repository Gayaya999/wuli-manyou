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
