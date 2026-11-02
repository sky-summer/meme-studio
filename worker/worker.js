/**
 * 表情包接口 HTTPS 代理（Cloudflare Worker）
 *
 * 作用：
 *   1. 把 HTTP 接口包一层 HTTPS，GitHub Pages 这类 HTTPS 页面才能调用；
 *   2. 补上 CORS 头，浏览器不再被跨域拦截；
 *   3. 浏览器的请求只打到本 Worker 的域名，真实接口地址保存在 Worker 的环境变量里，
 *      不会出现在前端代码、页面文字、请求 URL 或请求头中。
 *
 * 部署（在 worker 目录执行）：
 *   npx wrangler deploy
 *   npx wrangler secret put ORIGIN     # 粘贴真实接口地址，如 http://<ip>:<port>
 *
 * 说明：若 Cloudflare 不允许访问该端口，可改用 cloudflared 隧道或自建 Nginx 反代，
 *       只要最终暴露的是一个 HTTPS + 带 CORS 的地址即可。
 */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-max-age': '86400',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const origin = String((env && env.ORIGIN) || '').replace(/\/+$/, '');
    if (!origin) {
      return new Response(JSON.stringify({ detail: 'ORIGIN 未配置' }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
      });
    }

    const url = new URL(request.url);

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('origin');
    headers.delete('referer');

    const noBody = request.method === 'GET' || request.method === 'HEAD';
    const body = noBody ? undefined : await request.arrayBuffer();

    let upstream;
    try {
      upstream = await fetch(origin + url.pathname + url.search, {
        method: request.method,
        headers,
        body,
      });
    } catch (err) {
      return new Response(JSON.stringify({ detail: `上游请求失败：${err.message}` }), {
        status: 502,
        headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
      });
    }

    const out = new Headers(upstream.headers);
    Object.entries(CORS).forEach(([key, value]) => out.set(key, value));
    out.delete('content-security-policy');

    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
