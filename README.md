# 表情包工坊 · Meme Studio

纯静态表情包生成器，对接 **meme-generator** 服务：选择模板、填写文字 / 上传图片后由服务端渲染，
支持 JPG、PNG、GIF 动图输出与下载。

> 本项目的部署目标只有一个：**Linux 服务器**。页面通过同源 `/api` 访问真实接口，
> 真实地址只写在服务器上的 `.env`（或 Nginx 配置）里，不进仓库、不出现在页面中。

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
index.html          页面结构
app.js              前端逻辑（全部走同源 /api）
style.css           样式
server.js           静态托管 + /api 反向代理（零依赖，可选）
.env.example        接口地址配置示例（复制为 .env）
deploy/nginx.conf       Nginx 站点配置示例
deploy/systemd.service  systemd 单元（用 node 常驻时）
```

## 一、准备

```bash
sudo mkdir -p /var/www/meme-studio
# 把 index.html app.js style.css server.js .env.example 上传到上面目录
```

服务器需要能访问接口，先验证：

```bash
curl -s http://<接口地址>/meme/version
```

## 二、部署方式 A：Nginx 直接托管（不需要 Node）

`deploy/nginx.conf` 拷到 `/etc/nginx/conf.d/meme-studio.conf`，改两处：`server_name` 和 `proxy_pass`。

```nginx
server {
    listen 80;
    server_name _;                       # 或你的域名 / 服务器 IP
    root /var/www/meme-studio;
    index index.html;
    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://<接口地址>/;    # 结尾斜杠不能少
        proxy_set_header Host <接口地址>;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -s http://127.0.0.1/api/meme/version      # 应返回 "0.1.14"
```

打开 `http://<服务器IP>/` 即可使用。

## 三、部署方式 B：Node 常驻（自带代理，无需额外配置 Nginx 的 /api）

```bash
cd /var/www/meme-studio
cp .env.example .env
vi .env                      # 填 MEME_API=<接口地址>，PORT=8080
node server.js               # 先手工跑一遍确认
```

常驻：

```bash
sudo cp deploy/systemd.service /etc/systemd/system/meme-studio.service
sudo vi /etc/systemd/system/meme-studio.service   # 改 WorkingDirectory / ExecStart 路径
sudo systemctl daemon-reload
sudo systemctl enable --now meme-studio
```

Nginx 整站反代（含可选 HTTPS）：

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_read_timeout 300s;
    client_max_body_size 20m;
}
```

## 四、HTTPS（可选）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <你的域名>
```

因为页面和 `/api` 同源，HTTP/HTTPS 都能正常生成，不存在跨域和混合内容问题。

## 五、排查

| 现象 | 处理 |
| --- | --- |
| 页面显示「无法连接同源 /api」 | 检查 Nginx `location /api/` 的 `proxy_pass` 是否带结尾斜杠；`curl http://127.0.0.1/api/meme/version` |
| 502 / 504 | 服务器到接口不通，或渲染总览图超时（`proxy_read_timeout` 调到 300s） |
| 上传大图 413 | 调大 `client_max_body_size` |
| 模板列表空 | 接口 `/memes/keys` 返回带 BOM，前端已兼容；确认 HTTP 状态 200 |
| 总览图慢 | 全部模板约 30 秒、数 MB，属正常 |
