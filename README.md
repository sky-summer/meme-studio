# 表情包工坊 · Meme Studio

纯静态表情包生成器，界面直接对接 **meme-generator** 服务：
859 个模板，填写文字 / 上传图片后由服务端实时渲染，支持 JPG、PNG、GIF 动图输出与下载。

> 仓库里不保存任何真实服务地址，接口地址通过 `.env`（本地）或页面「接口地址」输入框（线上）配置。

## 功能

| 功能 | 用到的接口 |
| --- | --- |
| 连接状态、版本号 | `GET /meme/version` |
| 模板列表 | `GET /memes/keys` |
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
.env.example    本地接口地址配置示例
```

## 本地运行

接口服务没有返回 CORS 头，浏览器不能跨域直连，所以本地要走 `server.js` 的代理：

```bash
cp .env.example .env      # 填入 MEME_API=<你的接口地址>
node server.js            # 打开 http://localhost:8080
```

也可以用环境变量临时指定：

```bash
MEME_API=<接口地址> PORT=8080 node server.js
```

没配置 `MEME_API` 时，`/api/*` 会返回 503 并在控制台提示。

## 部署到 GitHub Pages

页面本身是纯静态的，推到仓库后在 **Settings → Pages** 选择 `main` 分支、`/ (root)` 即可，
访问 `https://<用户名>.github.io/<仓库名>/`。

> ⚠️ 本地接口服务只有 `http://`，而 GitHub Pages 跑在 HTTPS 下，浏览器会以「混合内容」为由拦截请求。
> 线上必须准备一个 **HTTPS 反向代理**，两种填法任选：
>
> 1. 页面「接口地址」输入框直接填代理地址（存进 localStorage，下次自动连接）；
> 2. 或修改 `config.js` 里的 `window.MEME_API_BASE` 后推送。
>
> 代理可以用 cloudflared 临时隧道一键得到：
>
> ```bash
> cloudflared tunnel --url <你的接口地址>
> # 得到形如 https://xxx-xxx.trycloudflare.com 的地址
> ```
>
> 自建 Nginx / Vercel / Cloudflare Worker 也可以，注意响应头需要带
> `Access-Control-Allow-Origin: *`（本地 `server.js` 已经做了这件事）。

## 说明

- 模板列表与关键词元数据会缓存在 localStorage（`meme-studio:info:v1`），命中缓存后不再重复请求。
- 总览图渲染全部模板约需 30 秒，文件可达数 MB，点击预览图可查看原图。
