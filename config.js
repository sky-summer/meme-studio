/**
 * 部署配置：线上环境使用的接口地址。
 *
 * - 本地 `node server.js` 运行时留空即可，页面会自动走同源 /api 代理。
 * - 线上走 worker/ 里的 Cloudflare Worker 代理：浏览器只访问下面这个 HTTPS 域名，
 *   真实接口地址只存在 Worker 的环境变量 ORIGIN 里，不出现在页面、代码和请求中。
 * - 也可以在页面的「接口地址」输入框里填别的地址，改完会存到浏览器 localStorage。
 */
window.MEME_API_BASE = 'https://meme-proxy.2890049109.workers.dev';
