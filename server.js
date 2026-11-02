/**
 * 静态服务器 + 接口反向代理（单进程即可对外服务，不需要 Nginx）
 *
 * 用法：
 *   1) cp .env.example .env 并填入 MEME_API=<接口地址>
 *   2) node server.js
 *   3) 浏览器访问 http://<服务器IP>:8080
 *
 * 环境变量：PORT（默认 8080）、MEME_API（必填）、HOST（默认 0.0.0.0）
 * 仓库里不保存任何真实服务地址。
 */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const text = line.trim();
      if (!text || text.startsWith('#')) return;
      const eq = text.indexOf('=');
      if (eq < 1) return;
      out[text.slice(0, eq).trim()] = text
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
    });
  return out;
}

const fileEnv = loadDotEnv(path.join(ROOT, '.env'));
const PORT = Number(process.env.PORT || fileEnv.PORT || 8080);
const HOST = process.env.HOST || fileEnv.HOST || '0.0.0.0';
const TARGET = (process.env.MEME_API || fileEnv.MEME_API || '').replace(/\/+$/, '');
const TARGET_HOST = TARGET ? new URL(TARGET).host : '';

function localAddresses() {
  const out = [];
  Object.values(os.networkInterfaces()).forEach((list) => {
    (list || []).forEach((net) => {
      const isV4 = net.family === 'IPv4' || net.family === 4;
      if (isV4 && !net.internal) out.push(net.address);
    });
  });
  return out;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function proxy(req, res) {
  if (!TARGET) {
    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ detail: '未配置接口地址：请在 .env 中设置 MEME_API，或用 MEME_API=<地址> node server.js 启动' }));
    return;
  }
  const url = new URL(req.url, 'http://localhost');
  const targetPath = url.pathname.slice('/api'.length) || '/';
  const targetUrl = TARGET + targetPath + url.search;

  const headers = { ...req.headers, host: TARGET_HOST };
  delete headers.origin;
  delete headers.referer;

  const upstream = http.request(targetUrl, { method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode || 502, {
      ...up.headers,
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'cache-control': 'no-store',
    });
    up.pipe(res);
  });

  upstream.on('error', (err) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ detail: `代理请求失败：${err.message}` }));
  });

  upstream.setTimeout(180000, () => upstream.destroy(new Error('上游超时')));

  if (req.method === 'GET' || req.method === 'HEAD') upstream.end();
  else req.pipe(upstream);
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-max-age': '86400',
    });
    res.end();
    return;
  }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api' || pathname.startsWith('/api/')) proxy(req, res);
  else serveStatic(req, res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`启动失败：端口 ${PORT} 已被占用`);
    console.error('  1) 是否已有实例在跑：pm2 list / ss -lntp | grep ' + PORT);
    console.error('  2) 停掉占用进程：pm2 stop <名称>  或  kill <pid>');
    console.error('  3) 或换个端口：改 .env 里的 PORT 后重启');
    process.exit(1);
  }
  if (err.code === 'EACCES') {
    console.error(`启动失败：没有权限监听端口 ${PORT}（1024 以下端口需要 root 或 authbind）`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log('表情包工坊已启动');
  console.log(`  本机访问：http://localhost:${PORT}`);
  localAddresses().forEach((ip) => console.log(`  外部访问：http://${ip}:${PORT}`));
  if (TARGET) console.log(`  接口代理：/api/* → ${TARGET}`);
  else console.log('  未配置 MEME_API（.env 或环境变量），/api/* 将返回 503');
});
