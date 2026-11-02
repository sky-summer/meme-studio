/**
 * 本地开发服务器：托管静态页面 + 反向代理表情包接口（解决浏览器跨域限制）
 * 用法：node server.js  →  http://localhost:8080
 * 可用环境变量：PORT（默认 8080）、MEME_API（默认 http://120.48.4.118:2233）
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8080);
const TARGET = (process.env.MEME_API || 'http://120.48.4.118:2233').replace(/\/+$/, '');
const TARGET_HOST = new URL(TARGET).host;
const ROOT = __dirname;

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

http
  .createServer((req, res) => {
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
  })
  .listen(PORT, () => {
    console.log(`表情包工坊已启动：http://localhost:${PORT}`);
    console.log(`接口代理：/api/* → ${TARGET}`);
  });
