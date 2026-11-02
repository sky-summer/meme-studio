/**
 * 部署配置：线上环境使用的接口地址。
 *
 * - 本地 `node server.js` 运行时留空即可，页面会自动走同源 /api 代理。
 * - 部署到 GitHub Pages 等 HTTPS 站点时，这里填 HTTPS 代理域名
 *   （例如 worker/ 目录里那个 Cloudflare Worker 部署后得到的
 *   https://<名称>.<子域>.workers.dev）。真实接口地址只存在代理的服务端，
 *   不会出现在页面文字、前端代码或浏览器请求中。
 * - 也可以在页面的「接口地址」输入框里填，改完会存到浏览器 localStorage。
 */
window.MEME_API_BASE = '';
