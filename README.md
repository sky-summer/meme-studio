# 表情包工坊 · Meme Studio

纯静态表情包生成器，界面直接对接 **meme-generator** 服务（`http://120.48.4.118:2233`）：
859 个模板，填写文字 / 上传图片后由服务端实时渲染，支持 JPG、PNG、GIF 动图输出与下载。

接口文档：<http://120.48.4.118:2233/docs>

## 功能

| 功能 | 用到的接口 |
| --- | --- |
| 连接状态、版本号 | `GET /meme/version` |
| 模板列表（859 个） | `GET /memes/keys` |
| 模板参数（图片数、文字数、默认文字、高级参数） | `GET /memes/{key}/info` |
| 模板示例图预览 | `GET /memes/{key}/preview` |
| 生成表情包 | `POST /memes/{key}/`（multipart：`images` + `texts` + `args`） |
| 模板总览图（全部 / 当前筛选） | `POST /memes/render_list` |

## 目录

```
index.html      页面结构
app.js          全部前端逻辑（接口调用、表单、预览、下载）
style.css       样式
config.js       部署配置：接口（代理）地址
server.js       本地静态服务 + /api 反向代理（零依赖，解决跨域）
```

## 本地运行

接口服务没有返回 CORS 头，浏览器不能跨域直连，所以本地要走 `server.js` 的代理：

```bash
node server.js          # 打开 http://localhost:8080
```

`/api/*` 会被转发到 `http://120.48.4.118:2233/*`，可通过环境变量覆盖：

```bash
MEME_API=http://127.0.0.1:2233 PORT=8080 node server.js
```

## 部署到 GitHub Pages

页面本身是纯静态的，推到仓库后在 **Settings → Pages** 选择 `main` 分支、`/ (root)` 即可，
访问 `https://<用户名>.github.io/<仓库名>/`。

> ⚠️ 重要：GitHub Pages 跑在 HTTPS 下，而表情包接口只有 `http://`，浏览器会以「混合内容」为由拦截请求。
> 因此线上必须填一个 **HTTPS 代理地址**，两种方式任选：
>
> 1. 页面左下角「接口地址」直接填代理地址（会存进 localStorage）；
> 2. 或修改 `config.js` 里的 `window.MEME_API_BASE` 后重新推送。
>
> 用一个 HTTPS 反向代理把接口包一层即可，例如 cloudflared 临时隧道：
>
> ```bash
> cloudflared tunnel --url http://120.48.4.118:2233
> # 得到形如 https://xxx-xxx.trycloudflare.com 的地址，填进「接口地址」
> ```
>
> 或者用 Nginx / Vercel / Cloudflare Worker 自建，注意响应头需要带上
> `Access-Control-Allow-Origin: *`（本地 `server.js` 已经做了这件事）。

## 说明

- 模板列表与关键词元数据会缓存在 localStorage（`meme-studio:info:v1`），命中缓存后不再重复请求。
- 总览图渲染全部 859 个模板约需 30 秒，文件约 4.8 MB（4907×5460），点击预览图可查看原图。
