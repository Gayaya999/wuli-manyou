# 单服务器上线说明

本目录只是可审计的部署模板，本轮不会自动部署。

1. 将网站同步到 `/srv/wuli-manyou`，不要同步 `.env`、测试输出或 `.git`。
2. 复制 `.env.example` 为仓库根目录 `.env`，填入真实域名和服务端密钥。
3. 使用 `uvicorn server.app:app --host 127.0.0.1 --port 8787` 启动 FastAPI；不要把 8787 直接暴露到公网。
4. 将 Nginx 示例里的域名和证书路径替换为真实值，再启用 HTTPS。
5. 访客没有上传接口。站长只在本地运行 `node tools/publish-game-module.mjs <已验收模块目录>`，然后重新部署静态目录。

## 社区互动（零后端）

点赞与留言簿不依赖任何服务端接口：

- 展陈层：`data/community-seed.json` 随站发布，含精选赞数与展板留言，由站长在仓库维护。
- 个人层：访客的点赞与留言存浏览器 localStorage，仅本机可见，页面已明确标注。
- 缓存纪律：HTML 一律 `no-cache`；带 `?v=` 版本戳的 js/css 与媒体资源 `immutable`。更新前端文件后必须同步 bump 三个 HTML 里的 `?v=` 戳，否则访客会粘住旧资源。
- CSP 含 `frame-ancestors 'self'`（防外站嵌入，且不影响本页沙箱游戏舱）与 `font-src ... data:`（沙箱舱字体走 data URL）。

上线前必须再次验证：HTTPS、安全响应头、严格 MIME、同域 `/api`、额度耗尽回退、密钥不进入前端、公开作品按需加载、社区点赞/留言纯文本渲染且本机持久。
