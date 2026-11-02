/**
 * 部署配置：填写表情包接口（或其 HTTPS 代理）地址。
 *
 * - 本地 `node server.js` 运行时留空即可，页面会自动走同源 /api 代理。
 * - 部署到 GitHub Pages 等 HTTPS 站点时必须填 HTTPS 地址，
 *   例如 Cloudflare Worker 代理：'https://meme-proxy.<你的子域>.workers.dev'
 * - 页面右下角「接口地址」也可以直接改，改完会存到浏览器 localStorage。
 */
window.MEME_API_BASE = '';
