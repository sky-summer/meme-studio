# 表情包工坊 · Meme Studio

纯静态表情包生成器，对接 **meme-generator** 服务：选择模板、填写文字 / 上传图片后由服务端渲染，
支持 JPG、PNG、GIF 动图输出与下载。

> 部署方式：**Linux 服务器上单进程运行 `node server.js`，直接用 `http://<服务器IP>:8080` 访问**。
> 不需要 Nginx，也没有域名、CDN、Worker 之类的额外依赖。
> 页面只请求同源 `/api`，真实接口地址只写在服务器上的 `.env` 里，不进仓库、不出现在页面中。

## 功能

| 功能 | 接口 |
| --- | --- |
| 连接状态、版本号 | `GET /meme/version` |
| 模板列表 | `GET /memes/keys` |
| 模板参数（图片数、文字数、默认文字、高级参数） | `GET /memes/{key}/info` |
| 模板示例图 | `GET /memes/{key}/preview` |
| 生成表情包 | `POST /memes/{key}/`（multipart：`images` + `texts` + `args`） |
| 模板总览图（全部 / 当前筛选） | `POST /memes/render_list` |

## 目录

```
index.html            页面结构
app.js                前端逻辑（全部请求同源 /api）
style.css             样式
server.js             静态托管 + /api 反向代理 + 启动时打印访问地址
.env.example          配置示例（复制成 .env）
deploy/systemd.service  开机自启模板
```

## 一、服务器上部署

```bash
# 1. 需要 Node.js 18+
node -v

# 2. 放代码
sudo mkdir -p /var/www/meme-studio
# 上传 index.html app.js style.css server.js .env.example 到该目录
cd /var/www/meme-studio

# 3. 配置接口地址
cp .env.example .env
vi .env                 # MEME_API=<接口地址>   PORT=8080
chmod 600 .env

# 4. 先手工启动，确认能出图
node server.js
```

启动后终端会打印：

```
表情包工坊已启动
  本机访问：http://localhost:8080
  外部访问：http://192.168.x.x:8080
  接口代理：/api/* → <接口地址>
```

浏览器打开 `http://<服务器IP>:8080` 即可使用。

## 二、放行端口

```bash
# firewalld（CentOS / Rocky）
sudo firewall-cmd --permanent --add-port=8080/tcp && sudo firewall-cmd --reload

# ufw（Ubuntu / Debian）
sudo ufw allow 8080/tcp
```

云服务器还要在控制台的**安全组**里放行 8080/TCP。

## 三、常驻运行

```bash
sudo cp deploy/systemd.service /etc/systemd/system/meme-studio.service
sudo vi /etc/systemd/system/meme-studio.service    # 核对 WorkingDirectory / ExecStart 路径
sudo systemctl daemon-reload
sudo systemctl enable --now meme-studio
sudo systemctl status meme-studio
journalctl -u meme-studio -f                       # 看日志
```

更新代码后：`sudo systemctl restart meme-studio`。

## 四、配置项（.env 或环境变量）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `MEME_API` | 无（必填） | 真实接口地址，如 `http://<ip>:<port>` |
| `PORT` | `8080` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址，只需本机访问可设 `127.0.0.1` |

也可以临时用环境变量启动：

```bash
MEME_API=http://<ip>:<port> PORT=8080 node server.js
```

## 五、排错

| 现象 | 处理 |
| --- | --- |
| 浏览器打不开 | 端口是否放行（firewalld / ufw / 云安全组）；`ss -lntp \| grep 8080` |
| 页面显示「无法连接同源 /api」 | 服务器能否访问接口：`curl -s http://<接口地址>/meme/version`；再看 `journalctl -u meme-studio -n 50` |
| `/api` 返回 503 | `.env` 里的 `MEME_API` 没配置或没生效（改完要重启服务） |
| 502 / 503 且日志有超时 | 服务器到接口网络不通 |
| 上传大图失败 | 目前无上传体积限制，多为网络中断，重试即可 |
| 总览图很慢 | 全部模板约 30 秒、数 MB，属正常 |
| 模板列表为空 | `/memes/keys` 返回带 BOM，前端已兼容；确认接口 HTTP 200 |
