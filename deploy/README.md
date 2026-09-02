# 单服务器上线说明

本目录只是可审计的部署模板，本轮不会自动部署。

1. 将网站同步到 `/srv/wuli-manyou`，不要同步 `.env`、测试输出或 `.git`。
2. 复制 `.env.example` 为仓库根目录 `.env`，填入真实域名和服务端密钥。
3. 使用 `uvicorn server.app:app --host 127.0.0.1 --port 8787` 启动 FastAPI；不要把 8787 直接暴露到公网。
4. 将 Nginx 示例里的域名和证书路径替换为真实值，再启用 HTTPS。
5. 访客没有上传接口。站长只在本地运行 `node tools/publish-game-module.mjs <已验收模块目录>`，然后重新部署静态目录。

上线前必须再次验证：HTTPS、安全响应头、严格 MIME、同域 `/api`、额度耗尽回退、密钥不进入前端、公开作品按需加载。
